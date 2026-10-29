"""Local browser regression tests. All identities and API records below are test fixtures.
Run a built Vite preview on port 5173, then: python3 scripts/workspace-browser.py
Requires Python Playwright and Chromium; no real OAuth session or database is used.
"""
import base64
import copy
import json
import os
from pathlib import Path
import re
import time
import unittest
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('CATAPIMBA_TEST_ORIGIN', 'http://127.0.0.1:5173')
ARTIFACTS = Path(os.environ.get('CATAPIMBA_TEST_ARTIFACTS', '/tmp/catapimba-refinement'))
UID = '91000000-0000-0000-0000-000000000001'
IID = '92000000-0000-0000-0000-000000000001'
OTHER = '92000000-0000-0000-0000-000000000002'
STORE = 'sb-sahxhhbpagnygnpjtfxz-auth-token'
INST = dict(id=IID, name='Instituição de teste', status='active')
PROJECT = dict(id='p1', institution_id=IID, name='Projeto de teste', summary='Descrição de teste', category='Educação', stage='Descoberta', year=2026, semester=2, archived=False, created_at='2026-10-25T10:00:00Z')
CRITERION = dict(id='c1', name='Inovação', weight=1, active=True, descriptors=['Insuficiente', 'Inicial', 'Adequado', 'Bom', 'Excelente'])
EVENT = dict(id='e1', name='Banca de teste', status='open', scheduled_at='2026-12-01T10:00:00Z', criteria_snapshot=[CRITERION], results_published=False)

class Scenario:
    def __init__(self, browser, role='platform', width=390, guest=False):
        self.context = browser.new_context(viewport=dict(width=width, height=900), reduced_motion='reduce')
        if not guest:
            token = 'eyJhbGciOiJIUzI1NiJ9.' + base64.urlsafe_b64encode(json.dumps({'sub': UID, 'exp': int(time.time())+3600}).encode()).decode().rstrip('=') + '.test'
            session = dict(access_token=token, refresh_token='fixture-only', expires_at=int(time.time())+3600, expires_in=3600, token_type='bearer', user={'id': UID, 'email': 'test@example.test'})
            self.context.add_init_script(f'localStorage.setItem({json.dumps(STORE)}, {json.dumps(json.dumps(session))});')
        self.role = role
        self.identity = dict(user={'id': UID, 'email': 'test@example.test'}, isPlatformAdministrator=role=='platform', memberships=[dict(id='m1', institution_id=IID, status='active', institutions=INST, membership_roles=[{'role': 'evaluator' if role=='platform' else role}])])
        admin = role in ['platform', 'institution_admin']
        manager = admin or role=='coordinator'
        self.data = dict(institution=copy.deepcopy(INST), capabilities=dict(manageMembers=admin, manageProjects=admin, manageEvents=manager, manageCriteria=admin, evaluate=role=='evaluator', readAudit=admin), projects=[copy.deepcopy(PROJECT)], participants=[dict(project_id='p1', user_id=UID, kind='student' if role=='student' else 'mentor')], criteria=[copy.deepcopy(CRITERION)], events=[copy.deepcopy(EVENT)], eventProjects=[dict(event_id='e1', project_id='p1')], eventEvaluators=[dict(event_id='e1', user_id=UID)], evaluations=[], memberships=[dict(id='m1', user_id=UID, status='active', roles=[role], requested_role=None)], people=[dict(id=UID, name='Pessoa de teste', email='test@example.test')], results=[], audit=[])
        self.catalog = [copy.deepcopy(INST)]
        self.contexts = {IID: self.data}
        self.commands = []
        self.errors = []
        self.catalog_status = self.workspace_status = self.identity_status = 200
        self.command_status = 200
        self.logout_status = 204
        self.google_enabled = True
        self.malformed_workspace = False
        self.context.route('**/api/**', self.route)
        self.context.route('https://*.supabase.co/**', self.auth_route)
        self.page = self.context.new_page()
        self.page.set_default_timeout(6000)
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))

    def route(self, r):
        url = r.request.url
        status = 200
        if '/api/concierge/status' in url:
            body = {'available': False}
        elif '/api/auth/me' in url:
            status, body = self.identity_status, self.identity
        elif '/api/admin/institutions' in url:
            body = {'institutions': self.catalog}
            if r.request.method=='PATCH':
                updated={**INST, **r.request.post_data_json}
                self.catalog=[updated if i['id']==IID else i for i in self.catalog]
                body={'institution':updated}
            elif r.request.method=='POST':
                created={**INST,'id':'new-institution',**r.request.post_data_json}
                self.catalog.append(created)
                body={'institution':created}
        elif '/workspace/catalog' in url:
            status, body = self.catalog_status, {'institutions': self.catalog}
        elif '/commands' in url:
            self.commands.append(r.request.post_data_json)
            status, body = self.command_status, {'ok': True, 'id': 'p1'}
            if status==200 and r.request.post_data_json['action']=='access.request':
                self.identity['memberships']=[dict(id='pending', institution_id=IID, status='pending', requested_role='student', institutions=INST, membership_roles=[])]
        elif '/export?' in url:
            return r.fulfill(status=self.command_status, content_type='text/csv', body='Projeto,Média\r\nProjeto de teste,4\r\n')
        else:
            if self.malformed_workspace:
                return r.fulfill(status=502, content_type='text/html', body='<html>Upstream unavailable</html>')
            status, body = self.workspace_status, self.contexts.get(url.split('/')[-1], self.data)
        if status >= 400: body = {'error': 'Operação negada para este teste.'}
        r.fulfill(status=status, json=body)

    def auth_route(self, r):
        if '/settings' in r.request.url:
            return r.fulfill(json={'external': {'google': self.google_enabled}})
        if '/logout' in r.request.url:
            return r.fulfill(status=self.logout_status, body='' if self.logout_status==204 else json.dumps({'message': 'Unavailable', 'code': 'unexpected_failure'}))
        r.fulfill(json={'user': self.identity['user']})

    def goto(self, path='/conta'):
        self.page.goto(BASE+path)
        return self.page

    def ready(self):
        expect(self.page.get_by_role('heading', name='O que pede atenção')).to_be_visible()

    def navigate(self, label):
        button = self.page.get_by_role('button', name='Abrir menu', exact=True)
        if button.is_visible(): button.click()
        self.page.get_by_role('navigation', name='Navegação principal').filter(visible=True).get_by_text(label, exact=True).click()

    def no_overflow(self):
        assert self.page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Horizontal document overflow'

    def close(self):
        assert not self.errors, self.errors
        self.context.close()

class WorkspaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=os.environ.get('CATAPIMBA_CHROMIUM', '/usr/bin/chromium'), args=['--no-sandbox'])
        ARTIFACTS.mkdir(parents=True, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def test_public_pages_and_responsive_layout(self):
        for width in [320, 390, 768, 1440]:
            with self.subTest(width=width):
                s = Scenario(self.browser, guest=True, width=width)
                p = s.goto('/')
                expect(p.get_by_role('heading', level=1)).to_contain_text('ideias')
                self.assertEqual(p.get_by_role('link', name=re.compile('demonstração|demo', re.I)).count(), 0)
                self.assertNotRegex(p.inner_text('main'), r'72%|18 projetos|2025\.2|fictícios|simulad')
                s.no_overflow()
                if width in [390, 1440]: p.screenshot(path=str(ARTIFACTS/f'public-{width}.png'), full_page=True)
                s.close()

    def test_legacy_routes_require_auth_and_unknown_is_not_found(self):
        s = Scenario(self.browser, guest=True)
        for route in ['/instituicao', '/superadmin', '/usuarios', '/projetos', '/projetos/novo', '/projetos/1', '/equipes', '/orientacao', '/bancas', '/bancas/1', '/criterios', '/avaliacoes', '/resultados', '/relatorios', '/podio', '/permissoes']:
            s.goto(route)
            expect(s.page.get_by_role('button', name='Entrar com Google')).to_be_visible()
            self.assertEqual(s.page.locator('.stat-grid').count(), 0)
        s.goto('/caminho-inexistente')
        expect(s.page.get_by_role('heading', level=1)).to_contain_text('não está disponível')
        s.close()

    def test_access_and_recovery_are_honest(self):
        s = Scenario(self.browser, guest=True)
        p = s.goto('/solicitar-acesso')
        expect(p.get_by_text('Nenhuma solicitação é enviada nesta página.', exact=False)).to_be_visible()
        self.assertEqual(p.locator('form').count(), 0)
        p.get_by_role('link', name='Continuar com minha conta').click()
        expect(p.get_by_role('button', name='Entrar com Google')).to_be_visible()
        s.goto('/recuperar-senha')
        self.assertEqual(p.locator('form').count(), 0)
        expect(p.get_by_role('link', name=re.compile('Recuperar conta Google'))).to_have_attribute('href', 'https://accounts.google.com/signin/recovery')
        self.assertEqual(s.commands, [])
        s.close()

    def test_google_disabled_does_not_fake_login(self):
        s = Scenario(self.browser, guest=True)
        s.google_enabled = False
        p = s.goto('/login')
        p.get_by_role('button', name='Entrar com Google').click()
        expect(p.get_by_role('alert')).to_contain_text('Google ainda está sendo configurado')
        self.assertTrue(p.url.endswith('/login'))
        expect(p.get_by_role('button', name='Entrar com Google')).to_be_enabled()
        s.close()

    def test_cancelled_callback_offers_login_without_success(self):
        s=Scenario(self.browser,guest=True)
        p=s.goto('/auth/callback?error=access_denied&error_description=Cancelled')
        expect(p.get_by_role('alert')).to_be_visible()
        expect(p.get_by_role('button',name='Entrar com Google')).to_be_visible()
        self.assertEqual(p.locator('.stat-grid').count(),0)
        s.close()

    def test_identity_failure_has_retry_without_business_data(self):
        s = Scenario(self.browser)
        s.identity_status = 401
        p = s.goto()
        expect(p.get_by_role('alert')).to_contain_text('sessão não é válida')
        expect(p.get_by_role('button', name='Tentar novamente')).to_be_visible()
        self.assertEqual(p.locator('.stat-grid').count(), 0)
        s.close()

    def test_logout_success(self):
        s = Scenario(self.browser)
        p=s.goto();s.ready()
        p.get_by_role('button', name='Sair da conta', exact=True).filter(visible=True).first.click()
        expect(p.get_by_role('button', name='Entrar com Google')).to_be_visible()
        self.assertIsNone(p.evaluate(f'localStorage.getItem({json.dumps(STORE)})'))
        s.close()

    def test_logout_partial_failure_is_honest_and_local_session_is_cleared(self):
        s = Scenario(self.browser)
        s.logout_status = 500
        p=s.goto();s.ready()
        p.get_by_role('button', name='Sair da conta', exact=True).filter(visible=True).first.click()
        expect(p.get_by_role('alert')).to_contain_text('não foi possível confirmar a revogação')
        expect(p.get_by_role('button', name='Entrar com Google')).to_be_visible()
        self.assertIsNone(p.evaluate(f'localStorage.getItem({json.dumps(STORE)})'))
        s.close()

    def test_six_role_interfaces(self):
        for role in ['platform', 'institution_admin', 'coordinator', 'mentor', 'evaluator', 'student']:
            with self.subTest(role=role):
                s=Scenario(self.browser, role=role)
                p=s.goto();s.ready()
                p.get_by_role('button', name='Abrir menu').click()
                nav=p.get_by_role('navigation', name='Navegação principal').filter(visible=True)
                self.assertEqual(nav.get_by_text('Usuários e acessos').count(), int(role in ['platform','institution_admin']))
                self.assertEqual(nav.get_by_text('Avaliações', exact=True).count(), int(role=='evaluator'))
                nav.get_by_text(re.compile('Projetos e')).click()
                expect(p.get_by_role('button', name='Projeto de teste', exact=True)).to_be_visible()
                if role in ['platform', 'institution_admin']:
                    p.get_by_role('button', name='Novo projeto', exact=True).click()
                    p.get_by_label('Nome do projeto', exact=True).fill('Projeto criado no teste')
                    p.get_by_label('Descrição do projeto').fill('Descrição criada')
                    p.get_by_role('button', name='Salvar projeto').click()
                    expect(p.get_by_role('status')).to_contain_text('Alteração registrada')
                    self.assertEqual(s.commands[-1]['action'],'project.save')
                elif role=='student':
                    p.get_by_role('button', name='Projeto de teste', exact=True).click()
                    p.get_by_role('button', name='Editar descrição').click()
                    self.assertEqual(p.get_by_label('Nome do projeto', exact=True).count(),0)
                    p.get_by_label('Descrição do projeto').fill('Somente minha descrição')
                    p.get_by_role('button', name='Salvar projeto').click()
                    expect(p.get_by_role('status')).to_contain_text('Alteração registrada')
                    self.assertEqual(set(s.commands[-1]['data']), {'id','summary'})
                elif role=='evaluator':
                    s.navigate('Avaliações')
                    p.get_by_role('combobox',name='Banca para avaliar').fill('Banca'); p.get_by_role('option',name='Banca de teste',exact=False).click()
                    p.get_by_role('combobox',name='Projeto para avaliar').fill('Projeto'); p.get_by_role('option',name='Projeto de teste',exact=False).click()
                    p.get_by_label('Nota para Inovação').select_option('5')
                    p.get_by_role('button', name='Enviar avaliação').click()
                    expect(p.get_by_text('Avaliação registrada.', exact=False)).to_be_visible()
                    self.assertEqual(s.commands[-1]['data']['scores'],{'c1':5})
                for module in ['events','criteria','results','podium','access']+(['members','reports','audit'] if role in ['platform','institution_admin'] else []):
                    s.goto('/app/'+module)
                    expect(p.locator('.workspace-content > .card').first).to_be_visible()
                    expect(p.get_by_text('Carregando seu contexto institucional…')).to_have_count(0)
                    s.no_overflow()
                s.goto();s.ready();s.no_overflow()
                if role=='platform':p.screenshot(path=str(ARTIFACTS/'workspace-mobile.png'),full_page=True)
                s.close()

    def test_no_false_success_on_mutation_failure(self):
        s=Scenario(self.browser);s.command_status=403
        p=s.goto('/app/projects')
        p.get_by_role('button',name='Novo projeto',exact=True).click()
        p.get_by_label('Nome do projeto',exact=True).fill('Projeto não salvo')
        p.get_by_label('Descrição do projeto').fill('Texto')
        p.get_by_role('button',name='Salvar projeto').click()
        expect(p.get_by_role('alert')).to_contain_text('Operação negada')
        expect(p.get_by_label('Nome do projeto',exact=True)).to_have_value('Projeto não salvo')
        self.assertEqual(p.get_by_role('status').count(),0)
        s.close()

    def test_workspace_errors_are_not_empty_memberships(self):
        for malformed in [False,True]:
            s=Scenario(self.browser);s.workspace_status=403;s.malformed_workspace=malformed
            p=s.goto()
            expect(p.get_by_text('Não foi possível abrir este contexto',exact=True)).to_be_visible()
            self.assertEqual(p.get_by_text('Bem-vindo à plataforma',exact=True).count(),0)
            self.assertEqual(p.locator('.stat-grid').count(),0)
            expect(p.get_by_role('button',name='Atualizar meu acesso')).to_be_visible()
            s.close()

    def test_catalog_failure_and_retry(self):
        s=Scenario(self.browser);s.identity['memberships']=[];s.catalog_status=503
        p=s.goto('/app/access')
        expect(p.get_by_role('alert')).to_contain_text('Operação negada')
        self.assertEqual(p.get_by_role('button',name='Solicitar acesso',exact=True).count(),0)
        s.catalog_status=200
        p.get_by_role('button',name='Recarregar instituições').click()
        expect(p.get_by_role('button',name='Solicitar acesso',exact=True)).to_be_visible()
        s.close()

    def test_real_access_command_success_and_failure(self):
        for status in [200,403]:
            s=Scenario(self.browser,role='student');s.identity['memberships']=[];s.command_status=status
            p=s.goto('/app/access')
            p.get_by_role('combobox',name='Instituição',exact=True).select_option(IID)
            p.get_by_role('button',name='Solicitar acesso',exact=True).click()
            if status==200:expect(p.get_by_text('Pendente',exact=True)).to_be_visible()
            else:
                expect(p.get_by_role('alert')).to_contain_text('Operação negada')
                self.assertEqual(p.get_by_text('Pendente',exact=True).count(),0)
            self.assertEqual(s.commands[-1],{'action':'access.request','data':{'role':'student'}})
            s.close()

    def test_filtered_empty_states(self):
        s=Scenario(self.browser)
        p=s.goto('/app/projects')
        p.get_by_label('Pesquisar projetos').fill('zzzz')
        expect(p.get_by_text('Nenhum projeto corresponde aos filtros',exact=True)).to_be_visible()
        s.goto('/app/events')
        p.get_by_label('Filtrar situação').select_option('closed')
        expect(p.get_by_text('Nenhuma banca corresponde ao filtro',exact=True)).to_be_visible()
        s.goto('/app/members')
        p.get_by_label('Pesquisar pessoa').fill('zzzz')
        expect(p.get_by_text('Nenhuma pessoa corresponde à pesquisa',exact=True)).to_be_visible()
        s.close()

    def test_project_container_opens_details_and_preserves_keyboard(self):
        s=Scenario(self.browser,width=1440); p=s.goto('/app/projects')
        p.get_by_role('cell',name='2026.2',exact=True).click()
        expect(p.locator('#project-detail')).to_be_visible()
        expect(p.locator('.project-table tr.selected')).to_have_count(1)
        p.get_by_role('button',name='Projeto de teste',exact=True).focus()
        p.keyboard.press('Enter')
        expect(p.locator('#project-detail')).to_be_visible(); s.close()

    def test_searchable_composition_and_chip_removal(self):
        s=Scenario(self.browser,role='coordinator',width=390); p=s.goto('/app/events')
        p.get_by_role('button',name='Nova banca',exact=True).click()
        search=p.get_by_role('textbox',name='Buscar em Projetos da banca')
        search.fill('zzzz'); expect(p.get_by_text('Nenhum item corresponde à busca.',exact=True)).to_be_visible()
        search.fill('Educação'); p.get_by_role('checkbox',name='Projeto de teste',exact=True).check()
        expect(p.get_by_text('1 selecionados',exact=True)).to_be_visible()
        p.get_by_role('button',name='Remover Projeto de teste',exact=True).click()
        expect(p.get_by_role('checkbox',name='Projeto de teste',exact=True)).not_to_be_checked()
        s.no_overflow(); p.screenshot(path=str(ARTIFACTS/'composition-mobile.png'),full_page=True); s.close()

    def test_combobox_keyboard_and_existing_evaluation_revision(self):
        s=Scenario(self.browser,role='evaluator',width=1440)
        s.data['evaluations']=[dict(id='eval',event_id='e1',project_id='p1',evaluator_id=UID,scores={'c1':3},notes='Parecer anterior',average=3,submitted_at='2026-10-25T10:00:00Z')]
        p=s.goto('/app/evaluations')
        field=p.get_by_role('combobox',name='Banca para avaliar'); field.fill('Banca'); p.keyboard.press('Enter')
        field=p.get_by_role('combobox',name='Projeto para avaliar'); field.fill('Projeto'); p.keyboard.press('Enter')
        expect(p.get_by_label('Nota para Inovação')).to_have_value('3')
        p.get_by_label('Nota para Inovação').select_option('5'); p.get_by_role('button',name='Enviar avaliação',exact=True).click()
        self.assertEqual(s.commands[-1]['data']['scores'],{'c1':5})
        expect(p.get_by_text('Você pode revisá-la',exact=False)).to_be_visible(); s.close()

    def test_form_cancel_resets_criterion_defaults(self):
        s=Scenario(self.browser)
        s.data['criteria'][0]['weight']=9
        p=s.goto('/app/criteria')
        p.get_by_role('button',name='Editar critério').click()
        expect(p.get_by_label('Peso',exact=True)).to_have_value('9')
        p.get_by_label('Descritor da nota 1').fill('Alterado sem salvar')
        p.get_by_role('button',name='Cancelar edição').click()
        expect(p.get_by_label('Peso',exact=True)).to_have_value('1')
        expect(p.get_by_label('Descritor da nota 1')).to_have_value('Evidências insuficientes')
        s.close()

    def test_confirmation_dialog_escape_and_mutation(self):
        s=Scenario(self.browser)
        p=s.goto('/app/events')
        p.get_by_role('button',name='Banca de teste').click()
        p.get_by_role('button',name='Cancelar banca',exact=True).click()
        dialog=p.get_by_role('dialog',name='Cancelar banca?')
        expect(dialog).to_be_visible()
        expect(dialog.get_by_role('button',name='Voltar')).to_be_focused()
        p.keyboard.press('Escape')
        expect(dialog).not_to_be_visible()
        self.assertEqual(s.commands,[])
        expect(p.get_by_role('button',name='Cancelar banca',exact=True)).to_be_focused()
        p.get_by_role('button',name='Cancelar banca',exact=True).click()
        dialog.get_by_role('button',name='Cancelar banca',exact=True).click()
        expect(p.get_by_role('status')).to_contain_text('Alteração registrada')
        self.assertEqual(s.commands[-1]['data']['status'],'cancelled')
        s.close()

    def test_institution_create_and_suspend_confirmation(self):
        s=Scenario(self.browser)
        p=s.goto('/app/institutions')
        p.get_by_label('Nome da instituição').fill('Instituição cadastrada no teste')
        p.get_by_role('button',name='Cadastrar instituição',exact=True).click()
        expect(p.get_by_role('status')).to_contain_text('Instituição cadastrada.')
        expect(p.locator('.institution-list').get_by_text('Instituição cadastrada no teste',exact=True)).to_be_visible()
        p.get_by_role('button',name='Suspender Instituição de teste',exact=True).click()
        dialog=p.get_by_role('dialog',name='Suspender instituição?')
        expect(dialog).to_be_visible()
        dialog.get_by_role('button',name='Voltar').click()
        expect(dialog).not_to_be_visible()
        expect(p.locator('.institution-list').get_by_text('Suspensa',exact=True)).to_have_count(0)
        p.get_by_role('button',name='Suspender Instituição de teste',exact=True).click()
        dialog.get_by_role('button',name='Suspender instituição',exact=True).click()
        expect(p.get_by_role('status')).to_contain_text('Instituição suspensa.')
        expect(p.locator('.institution-list').get_by_text('Suspensa',exact=True)).to_be_visible()
        s.close()

    def test_event_form_sends_scoped_composition(self):
        s=Scenario(self.browser,role='coordinator')
        s.data['memberships'].append(dict(id='m2',user_id='u2',status='active',roles=['evaluator'],requested_role=None))
        s.data['people'].append(dict(id='u2',name='Avaliador de teste',email=None))
        p=s.goto('/app/events')
        p.get_by_role('button',name='Nova banca',exact=True).click()
        p.get_by_label('Nome da banca').fill('Nova banca de teste')
        p.get_by_label('Data e horário').fill('2026-12-05T14:30')
        p.get_by_role('checkbox',name='Projeto de teste',exact=True).check()
        p.get_by_role('checkbox',name='Avaliador de teste',exact=True).check()
        p.get_by_role('button',name='Salvar banca',exact=True).click()
        expect(p.get_by_role('status')).to_contain_text('Alteração registrada')
        self.assertEqual(s.commands[-1]['action'],'event.save')
        self.assertEqual(s.commands[-1]['data']['project_ids'],['p1'])
        self.assertEqual(s.commands[-1]['data']['evaluator_ids'],['u2'])
        s.close()

    def test_results_podium_and_export(self):
        s=Scenario(self.browser, width=1440)
        s.data['results']=[dict(event_id='e1',name='Banca de teste',status='closed',published=False,rows=[dict(id='p1',name='Projeto de teste',score=4,position=1,submitted=2,expected=2)])]
        p=s.goto('/app/podium')
        expect(p.get_by_text('Publique o resultado',exact=False)).to_be_visible()
        expect(p.get_by_role('dialog')).to_have_count(0)
        s.navigate('Relatórios')
        with p.expect_download() as download:
            p.get_by_role('button',name='Exportar portfólio autorizado (CSV)').click()
        self.assertEqual(download.value.suggested_filename,'catapimba-projects.csv')
        p.get_by_label('Pesquisar no resultado').fill('zzzzz')
        expect(p.get_by_text('Nenhum projeto corresponde à pesquisa',exact=True)).to_be_visible()
        s.close()

    def test_context_switch_and_forbidden_page(self):
        s=Scenario(self.browser,width=1440)
        other_inst=dict(id=OTHER,name='Outra instituição de teste',status='active')
        other=copy.deepcopy(s.data);other['institution']=other_inst;other['projects'][0]['name']='Projeto da outra instituição'
        s.catalog.append(other_inst);s.contexts[OTHER]=other
        p=s.goto('/app/projects')
        expect(p.get_by_role('button',name='Projeto de teste',exact=True)).to_be_visible()
        p.get_by_label('Instituição atual').select_option(OTHER)
        expect(p.get_by_role('button',name='Projeto da outra instituição',exact=True)).to_be_visible()
        expect(p.get_by_role('button',name='Projeto de teste',exact=True)).to_have_count(0)
        p.screenshot(path=str(ARTIFACTS/'workspace-desktop.png'),full_page=True)
        s.close()
        s=Scenario(self.browser,role='student');p=s.goto('/app/members')
        expect(p.get_by_text('Esta página não está disponível para seu perfil',exact=True)).to_be_visible()
        self.assertEqual(p.get_by_role('button',name='Vincular pessoa',exact=True).count(),0)
        s.close()

    def test_responsive_workspace_with_long_content(self):
        for width in [320,768,1440]:
            with self.subTest(width=width):
                s=Scenario(self.browser,width=width)
                s.data['institution']['name']='Instituição '+('com nome extenso '*8)
                s.data['projects'][0]['name']='Projeto '+('com título extenso '*8)
                s.data['people'][0]['name']='Integrante '+('com nome extenso '*5)
                s.catalog[0]=s.data['institution']
                p=s.goto('/app/projects')
                expect(p.get_by_role('button',name=s.data['projects'][0]['name'],exact=True)).to_be_visible()
                s.no_overflow()
                self.assertGreaterEqual(p.get_by_role('button',name='Novo projeto',exact=True).bounding_box()['height'],44)
                s.close()

    def test_mobile_menu_is_hidden_when_resizing_to_desktop(self):
        s=Scenario(self.browser)
        p=s.goto();s.ready()
        p.get_by_role('button',name='Abrir menu').click()
        expect(p.locator('#mobile-navigation')).to_be_visible()
        p.set_viewport_size(dict(width=1440,height=900))
        expect(p.locator('#mobile-navigation')).not_to_be_visible()
        expect(p.get_by_role('navigation',name='Navegação principal').filter(visible=True)).to_have_count(1)
        s.close()

    def test_mobile_keyboard_menu_and_zoom(self):
        s=Scenario(self.browser)
        p=s.goto();s.ready()
        button=p.get_by_role('button',name='Abrir menu');button.focus();p.keyboard.press('Enter')
        expect(p.get_by_role('button',name='Fechar menu')).to_have_attribute('aria-expanded','true')
        p.keyboard.press('Tab');p.keyboard.press('Escape')
        expect(p.get_by_role('button',name='Abrir menu')).to_be_focused()
        p.add_style_tag(content='html { font-size: 30px !important; }')
        s.no_overflow()
        s.close()

if __name__=='__main__':unittest.main(verbosity=2)
