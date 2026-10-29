"""Original Catapimba instrumental cues. No external music or samples.
Reproduce with Python numpy/scipy and ffmpeg; committed MP3s need no runtime tools.
"""
from pathlib import Path
import subprocess
import numpy as np
from scipy.io.wavfile import write
from scipy.signal import butter, sosfilt
SR=44100
OUT=Path(__file__).resolve().parents[1]/'apps/web/src/features/podium/audio'
rng=np.random.default_rng(721)
def hz(m):return 440*2**((m-69)/12)
def note(m,d,voice='bell'):
 t=np.arange(int(d*SR))/SR; f=hz(m)
 if voice=='pad':
  wave=(np.sin(2*np.pi*f*t)+.26*np.sin(2*np.pi*(f*1.003)*t)+.17*np.sin(2*np.pi*2*f*t)+.07*np.sin(2*np.pi*3*f*t))
  env=np.minimum(t/.22,1)*np.minimum((d-t)/.55,1)
 elif voice=='brass':
  wave=sum(np.sin(2*np.pi*f*i*t)/i**1.8 for i in range(1,6));env=np.minimum(t/.035,1)*np.minimum((d-t)/.18,1)*(.7+.3*np.exp(-t*3))
 elif voice=='bass':wave=np.sin(2*np.pi*f*t)+.12*np.sin(2*np.pi*f*2*t);env=np.minimum(t/.014,1)*np.exp(-t*3)*np.minimum((d-t)/.05,1)
 else:wave=np.sin(2*np.pi*f*t)+.28*np.sin(2*np.pi*f*2.01*t)+.09*np.sin(2*np.pi*f*3*t);env=np.minimum(t/.004,1)*np.exp(-t*4)*np.minimum((d-t)/.04,1)
 return wave*np.clip(env,0,1)
def add(track,mono,start,gain=.1,pan=0):
 i=int(start*SR);n=min(len(mono),len(track)-i)
 if n<=0:return
 track[i:i+n,0]+=mono[:n]*gain*np.sqrt((1-pan)/2);track[i:i+n,1]+=mono[:n]*gain*np.sqrt((1+pan)/2)
def kick(d=.23):
 t=np.arange(int(d*SR))/SR;return np.sin(2*np.pi*(48*t+1.8*(1-np.exp(-t*35))))*np.exp(-t*23)
def shimmer(d=.15):
 t=np.arange(int(d*SR))/SR;noise=rng.normal(0,1,len(t));return sosfilt(butter(2,5200,'highpass',fs=SR,output='sos'),noise)*np.exp(-t*32)
def save(name,track):
 # Subtle stereo echoes, controlled peaks and gentle entry/exit.
 for delay,g in [(.145,.12),(.295,.08),(.43,.045)]:
  shift=int(delay*SR);track[shift:]+=track[:-shift,::-1]*g
 track=np.tanh(track*.9); peak=np.max(np.abs(track));track*=.8/max(peak,.8)
 fade=min(int(.06*SR),len(track)//4);track[:fade]*=np.linspace(0,1,fade)[:,None];track[-fade:]*=np.linspace(1,0,fade)[:,None]
 wav=Path('/tmp')/f'catapimba-{name}.wav';write(wav,SR,(track*32767).astype(np.int16));
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(wav),'-codec:a','libmp3lame','-q:a','5',str(OUT/f'{name}.mp3')],check=True)
 print(name,'seconds=',len(track)/SR,'peak=',round(float(np.max(np.abs(track))),3))
OUT.mkdir(parents=True,exist_ok=True)
# D-minor anticipation: layered pads, eighth-note pulse, bass and soft percussion.
beat=.625; bed=np.zeros((int(16*beat*SR),2))
for bar,chord in enumerate([[50,57,62,65],[46,53,58,62],[48,55,60,64],[45,52,57,64]]):
 for i,m in enumerate(chord):add(bed,note(m,4*beat,'pad'),bar*4*beat,.13,(-.6+i*.4))
 for tick in range(8):add(bed,note(chord[1+tick%3]+12,.6),bar*4*beat+tick*beat/2,.075,(-.35 if tick%2 else .35))
 for tick in range(4):
  add(bed,note(chord[0]-12,.5,'bass'),(bar*4+tick)*beat,.17)
  add(bed,kick(),(bar*4+tick)*beat,.14)
  add(bed,shimmer(),(bar*4+tick+.5)*beat,.022,.3)
save('anticipation',bed)
# D-major fanfare: melodic resolution, chord changes and a warm final cadence.
beat=.48; win=np.zeros((int(10*SR),2))
for bar,chord in enumerate([[50,57,62,66],[55,59,62,67],[47,54,59,62],[45,52,57,61]]):
 for i,m in enumerate(chord):add(win,note(m,4*beat+.3,'pad'),bar*4*beat,.16,-.6+i*.4)
 for tick in range(4):
  add(win,note(chord[0]-12,.45,'bass'),(bar*4+tick)*beat,.20)
  add(win,kick(),(bar*4+tick)*beat,.20)
  add(win,shimmer(.25),(bar*4+tick+.5)*beat,.04,.2)
melody=[74,78,81,83,81,78,76,74,79,78,76,74,73,76,81,86]
for index,m in enumerate(melody):
 add(win,note(m,.8,'brass'),index*beat,.12,0);add(win,note(m+12,.7),index*beat,.055,.4)
for i,m in enumerate([50,57,62,66,74,78,86]):add(win,note(m,2.3,'pad' if i<4 else 'bell'),16*beat,.13,-.5+i/6)
save('victory',win)
reveal=np.zeros((int(1.8*SR),2))
for i,m in enumerate([74,81,86]):add(reveal,note(m,1.4),i*.11,.16,-.3+i*.3)
save('reveal',reveal)
