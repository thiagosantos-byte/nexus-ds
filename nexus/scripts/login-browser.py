"""Login presentation tests using fixture auth/API, never real credentials or model calls."""
import importlib.util
from pathlib import Path
import unittest
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('workspace_fixtures',Path(__file__).with_name('workspace-browser.py'));fixtures=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixtures)
ARTIFACTS=Path('/tmp/catapimba-login');ARTIFACTS.mkdir(exist_ok=True)
class LoginTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.p=sync_playwright().start();cls.browser=cls.p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 @classmethod
 def tearDownClass(cls):cls.browser.close();cls.p.stop()
 def scenario(self,width=1440):return fixtures.Scenario(self.browser,guest=True,width=width)
 def test_simple_login_themes_and_persistence(self):
  s=self.scenario();p=s.goto('/login');expect(p.get_by_role('button',name='Entrar com Google')).to_be_visible();self.assertEqual(p.locator('input[type="password"]').count(),0)
  p.get_by_role('button',name='Ativar tema escuro').click();expect(p.locator('html')).to_have_attribute('data-theme','dark');p.screenshot(path=str(ARTIFACTS/'login-dark.png'),full_page=True);p.reload();expect(p.locator('html')).to_have_attribute('data-theme','dark')
  expect(p.get_by_role('button',name='Entrar com Google')).to_be_visible();p.get_by_role('button',name='Ativar tema claro').click();expect(p.locator('html')).to_have_attribute('data-theme','light');p.screenshot(path=str(ARTIFACTS/'login-light.png'),full_page=True);s.no_overflow();s.close()
 def test_accessibility_shortcut_filters_text_and_calm(self):
  s=self.scenario();p=s.goto('/login');p.get_by_role('button',name='Entrar com Google').wait_for();p.keyboard.press('Alt+Shift+a');dialog=p.get_by_role('dialog',name='Conforto e acessibilidade');expect(dialog).to_be_visible()
  dialog.get_by_role('switch',name='Modo tranquilo').click();dialog.get_by_role('switch',name='Texto ampliado').click();dialog.get_by_label('Ajuste de cores').select_option('deuteranopia');expect(p.locator('html')).to_have_attribute('data-color-filter','deuteranopia');expect(p.locator('html')).to_have_attribute('data-calm','true')
  p.keyboard.press('Escape');expect(dialog).not_to_be_visible();expect(p.get_by_role('button',name='Opções de acessibilidade')).to_be_focused();expect(p.locator('.login-visual')).not_to_be_visible();self.assertEqual(p.locator('canvas').count(),0);s.no_overflow()
  p.keyboard.press('Alt+Shift+l');expect(p.get_by_role('button',name='Entrar com Google')).to_be_focused();p.reload();expect(p.locator('html')).to_have_attribute('data-calm','true');s.close()
 def test_guided_chat_recovery_and_no_fictional_actions(self):
  s=self.scenario(390);p=s.goto('/login');p.get_by_role('button',name='Vamos juntos?',exact=False).click();expect(p.get_by_text('Guia de acesso com respostas prontas.',exact=False)).to_be_visible();p.get_by_role('button',name='Recuperar conta',exact=True).click();expect(p.get_by_role('log')).to_contain_text('Não consigo recuperar ou alterar sua conta');p.get_by_role('button',name='Pedir acesso',exact=True).click();expect(p.get_by_role('log')).to_contain_text('A gestão precisa aprovar');p.get_by_role('textbox',name='Sua dúvida sobre o acesso').fill('Como entrar?');p.get_by_role('button',name='Enviar dúvida').click();expect(p.get_by_role('log')).to_contain_text('Use “Entrar com Google”');self.assertEqual(s.commands,[]);s.no_overflow();p.screenshot(path=str(ARTIFACTS/'login-mobile-chat.png'),full_page=True);s.close()
 def test_responsive_login_without_webgl_for_any_motion_preference(self):
  for width in [320,390,768,1440]:
   for motion in ['reduce','no-preference']:
    with self.subTest(width=width,motion=motion):
     s=self.scenario(width);s.page.emulate_media(reduced_motion=motion);requests=[];s.page.on('request',lambda r:requests.append(r.url));p=s.goto('/login')
     expect(p.get_by_role('button',name='Entrar com Google')).to_be_visible();s.no_overflow();self.assertEqual(p.locator('canvas, .login-visual, .static-podium').count(),0);self.assertFalse(any('InteractivePodium-' in r for r in requests))
     self.assertLessEqual(p.locator('.login-layout').bounding_box()['width'],540);s.close()
if __name__=='__main__':unittest.main(verbosity=2)
