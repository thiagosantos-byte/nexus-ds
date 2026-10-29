"""Individual ceremony regression. All identities/results are fixtures, audio is real local MP3."""
import copy,importlib.util,os,unittest
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('workspace_fixtures',Path(__file__).with_name('workspace-browser.py'));f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
OUT=Path('/tmp/catapimba-podium');OUT.mkdir(exist_ok=True)
def result(ties=False):
 rows=[dict(id='p'+str(i),name=name,position=rank,score=score,submitted=1,expected=1) for i,(name,rank,score) in enumerate([('Aurora Solar',1,4.8),('Rota Acessível',1 if ties else 2,4.8 if ties else 4.4),('Horta Circular',2 if ties else 3,4.4 if ties else 4),('Água Viva',3 if ties else 4,4 if ties else 3.4)])]
 return dict(event_id='e1',name='Premiação de teste',status='closed',published=True,rows=rows)
class PodiumTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.p=sync_playwright().start();cls.browser=cls.p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 @classmethod
 def tearDownClass(cls):cls.browser.close();cls.p.stop()
 def scene(self,width=1440,ties=False,role='student',motion='reduce'):
  s=f.Scenario(self.browser,role=role,width=width);s.data['results']=[result(ties)];s.page.emulate_media(reduced_motion=motion);return s
 def test_order_suspense_pause_and_audio_opt_in(self):
  s=self.scene(motion='no-preference');p=s.page;requests=[];p.on('request',lambda r:requests.append(r.url));s.goto('/app/podium')
  dialog=p.get_by_role('dialog');expect(dialog).to_be_visible();expect(p.get_by_text('Aurora Solar',exact=True)).to_have_count(0)
  expect(dialog.get_by_text('Horta Circular',exact=True)).to_be_visible(timeout=6000);expect(dialog.get_by_text('Rota Acessível',exact=True)).to_have_count(0)
  dialog.get_by_role('button',name='Pausar',exact=True).click();value=dialog.get_by_role('progressbar').get_attribute('aria-valuenow');p.wait_for_timeout(1200);self.assertEqual(dialog.get_by_role('progressbar').get_attribute('aria-valuenow'),value)
  dialog.get_by_role('button',name='Continuar',exact=True).click();expect(dialog.get_by_text('Rota Acessível',exact=True)).to_be_visible(timeout=6000);expect(dialog.get_by_text('Aurora Solar',exact=True)).to_have_count(0)
  expect(dialog.get_by_role('heading',name='E o primeiro lugar…',exact=True)).to_be_visible(timeout=6000);expect(dialog.get_by_text('Aurora Solar',exact=True)).to_have_count(0)
  expect(dialog.get_by_text('Aurora Solar',exact=True)).to_be_visible(timeout=6000);expect(dialog.locator('.ceremony-confetti')).to_have_count(1)
  self.assertFalse(any('.mp3' in url for url in requests));dialog.get_by_role('button',name='Ver resultado agora',exact=True).click();expect(dialog.get_by_text('4,80',exact=False)).to_be_visible();p.wait_for_timeout(1200);self.assertGreater(float(dialog.locator('.award-rank-1').evaluate('e=>getComputedStyle(e).opacity')),.95);p.screenshot(path=str(OUT/'ceremony-desktop.png'),full_page=True);s.close()
 def test_skip_seen_replay_and_overview_notice(self):
  s=self.scene();p=s.goto('/conta');expect(p.get_by_role('complementary',name='Novo resultado publicado')).to_be_visible();p.get_by_role('link',name='Assistir à premiação',exact=True).click()
  dialog=p.get_by_role('dialog');expect(dialog).to_be_visible();dialog.get_by_role('button',name='Ver resultado agora',exact=True).click();expect(dialog.get_by_text('Aurora Solar',exact=True)).to_be_visible();p.keyboard.press('Escape');expect(dialog).to_have_count(0)
  p=s.goto('/conta');expect(p.get_by_role('complementary',name='Novo resultado publicado')).to_have_count(0)
  p=s.goto('/app/podium');expect(p.get_by_role('button',name='Rever premiação',exact=True)).to_be_visible();expect(p.get_by_role('dialog')).to_have_count(0)
  p.get_by_role('button',name='Rever premiação',exact=True).click();expect(p.get_by_role('dialog')).to_be_visible();expect(p.get_by_text('Aurora Solar',exact=True)).to_have_count(0);s.close()
 def test_unpublished_open_empty_and_incomplete_results_have_no_ceremony(self):
  for kind in ['unpublished','open','empty','incomplete']:
   with self.subTest(kind=kind):
    s=self.scene(role='platform');r=s.data['results'][0]
    if kind=='unpublished':r['published']=False
    if kind=='open':r['status']='open'
    if kind=='empty':r['rows']=[]
    if kind=='incomplete':r['rows'][0]['submitted']=0
    p=s.goto('/app/podium');expect(p.get_by_role('heading',name='Pódio de premiação',exact=True)).to_be_visible();expect(p.get_by_role('dialog')).to_have_count(0);expect(p.get_by_role('button',name='Ativar música',exact=True)).to_have_count(0);s.close()
 def test_mobile_ties_calm_long_names_and_all_published_roles(self):
  for width,role in [(320,'student'),(390,'mentor'),(768,'evaluator'),(1440,'coordinator')]:
   with self.subTest(width=width,role=role):
    s=self.scene(width=width,ties=True,role=role);s.data['results'][0]['rows'][0]['name']='Projeto com nome longo para verificar quebra de texto e acessibilidade'
    p=s.goto('/app/podium');dialog=p.get_by_role('dialog');expect(dialog).to_be_visible();dialog.get_by_role('button',name='Ver resultado agora',exact=True).click()
    expect(dialog.get_by_text('Empate · 2 projetos',exact=True)).to_be_visible();self.assertEqual(dialog.locator('.award-rank-1 li').count(),2);expect(dialog.locator('.ceremony-confetti')).to_have_count(0)
    dialog.get_by_role('button',name='Modo tranquilo',exact=True).click();expect(dialog.locator('.ceremony')).to_have_class('ceremony ceremony-calm');self.assertTrue(dialog.evaluate('e=>e.scrollWidth<=e.clientWidth'));s.no_overflow();p.screenshot(path=str(OUT/f'ceremony-{width}.png'),full_page=True);s.close()
 def test_single_rank_and_many_ties_do_not_invent_other_places(self):
  for count in [1,6]:
   with self.subTest(count=count):
    s=self.scene(width=320);s.data['results'][0]['rows']=[dict(id='x'+str(i),name='Projeto premiado '+str(i),position=1,score=4.8,expected=1,submitted=1) for i in range(count)]
    p=s.goto('/app/podium');dialog=p.get_by_role('dialog');dialog.get_by_role('button',name='Ver resultado agora',exact=True).click()
    expect(dialog.locator('.award-column')).to_have_count(1);expect(dialog.locator('.award-rank-1 li')).to_have_count(count);self.assertEqual(dialog.locator('.award-rank-1').evaluate('e=>getComputedStyle(e).gridColumnStart'),'2');self.assertTrue(dialog.evaluate('e=>e.scrollWidth<=e.clientWidth'));s.close()

 def test_real_audio_decodes_pause_resume_and_cleanup(self):
  s=self.scene();s.context.add_init_script('window.__ceremonyContexts=[];const OriginalAudio=window.AudioContext;window.AudioContext=class extends OriginalAudio{constructor(...args){super(...args);window.__ceremonyContexts.push(this);}};')
  p=s.goto('/app/podium');dialog=p.get_by_role('dialog');dialog.get_by_role('button',name='Ativar música',exact=True).click();expect(dialog.get_by_role('button',name='Silenciar música',exact=True)).to_be_visible(timeout=12000)
  self.assertEqual(p.evaluate('window.__ceremonyContexts[0].state'),'running');dialog.get_by_role('button',name='Pausar',exact=True).click();p.wait_for_function('window.__ceremonyContexts[0].state==="suspended"');dialog.get_by_role('button',name='Continuar',exact=True).click();p.wait_for_function('window.__ceremonyContexts[0].state==="running"')
  dialog.get_by_role('slider',name='Volume da música').focus();p.keyboard.press('ArrowRight');self.assertEqual(dialog.get_by_role('slider',name='Volume da música').input_value(),'26')
  p.keyboard.press('Escape');p.wait_for_function('window.__ceremonyContexts[0].state==="closed"');expect(dialog).to_have_count(0);s.close()
 def test_audio_failure_is_honest_and_does_not_block_reveal(self):
  s=self.scene();s.context.route('**/*.mp3',lambda r:r.fulfill(status=503,body='Unavailable'));p=s.goto('/app/podium');dialog=p.get_by_role('dialog');dialog.get_by_role('button',name='Ativar música',exact=True).click();expect(dialog.get_by_role('alert')).to_contain_text('Não foi possível carregar a música')
  expect(dialog.get_by_role('button',name='Silenciar música',exact=True)).to_have_count(0);dialog.get_by_role('button',name='Ver resultado agora',exact=True).click();expect(dialog.get_by_text('Aurora Solar',exact=True)).to_be_visible();s.close()
 def test_hiding_tab_pauses_without_automatically_resuming(self):
  s=self.scene();p=s.goto('/app/podium');dialog=p.get_by_role('dialog');expect(dialog).to_be_visible();p.evaluate('Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"));');expect(dialog.get_by_role('button',name='Continuar',exact=True)).to_be_visible();p.evaluate('Object.defineProperty(document,"hidden",{configurable:true,get:()=>false});document.dispatchEvent(new Event("visibilitychange"));');expect(dialog.get_by_role('button',name='Continuar',exact=True)).to_be_visible();s.close()
if __name__=='__main__':unittest.main(verbosity=2)
