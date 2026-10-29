import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  Maximize,
  Minimize,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  VolumeX,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "../../components/ui/button";
import { useAccessibility } from "../accessibility/AccessibilityProvider";
import type { Result } from "../workspace/types";
import { awards, revealedRanks, scoreText, timeline } from "./model";
import { markSeen } from "./seen";
import { CeremonyMusic } from "./music";
import { useCeremonyClock } from "./useCeremonyClock";
import "./podium.css";

export default function Ceremony({
  result,
  userId,
  institutionId,
  onClose,
}: {
  result: Result;
  userId: string;
  institutionId: string;
  onClose: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const { reduceMotion, preferences, update } = useAccessibility();
  const phases = timeline(result),
    duration = phases.at(-1)!.end;
  const clock = useCeremonyClock(duration);
  const phase =
    phases.find((step) => clock.elapsed < step.end) ?? phases.at(-1)!;
  const shown = revealedRanks(phases, clock.elapsed);
  const groups = awards(result);
  const [music, setMusic] = useState(false),
    [loadingMusic, setLoadingMusic] = useState(false),
    [volume, setVolume] = useState(25);
  const [confetti, setConfetti] = useState(true),
    [fullscreen, setFullscreen] = useState(false),
    [error, setError] = useState("");
  const sound = useRef<CeremonyMusic | null>(null);
  const alive = useRef(true);
  const seen = useRef(false);
  useEffect(() => {
    alive.current = true;
    const element = dialog.current;
    if (!element?.open) element?.showModal();
    const change = () => setFullscreen(document.fullscreenElement === element);
    document.addEventListener("fullscreenchange", change);
    return () => {
      alive.current = false;
      sound.current?.dispose();
      sound.current = null;
      document.removeEventListener("fullscreenchange", change);
      if (document.fullscreenElement === element)
        void document.exitFullscreen().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if ((phase.kind === "finale" || clock.done) && !seen.current) {
      seen.current = true;
      markSeen(userId, institutionId, result);
    }
  }, [phase.kind, clock.done, userId, institutionId, result]);
  useEffect(() => {
    const engine = sound.current;
    if (!engine) return;
    engine.volume(music ? volume : 0);
    if (clock.done) {
      engine.dispose();
      sound.current = null;
      setMusic(false);
      return;
    }
    engine.sync(
      phase,
      clock.elapsed,
      phases.find((step) => step.kind === "winner")!.start,
    );
    if (clock.paused) engine.pause();
    else
      void engine.resume().catch(() => {
        if (alive.current) {
          setMusic(false);
          setError(
            "O áudio foi interrompido. A apresentação continua sem som.",
          );
        }
      });
  }, [music, volume, phase.start, clock.paused, clock.done, clock.iteration]);
  async function toggleMusic() {
    setError("");
    if (music) {
      sound.current?.volume(0);
      setMusic(false);
      return;
    }
    setLoadingMusic(true);
    try {
      if (!sound.current) {
        const engine = new CeremonyMusic();
        sound.current = engine;
        await engine.prepare();
      } else await sound.current.resume();
      if (alive.current) {
        sound.current?.volume(volume);
        setMusic(true);
      }
    } catch {
      sound.current?.dispose();
      sound.current = null;
      if (alive.current)
        setError(
          "Não foi possível carregar a música. Você pode assistir sem som ou tentar novamente.",
        );
    } finally {
      if (alive.current) setLoadingMusic(false);
    }
  }
  function replay() {
    sound.current?.dispose();
    sound.current = null;
    setMusic(false);
    setError("");
    clock.replay();
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === dialog.current)
        await document.exitFullscreen();
      else if (dialog.current?.requestFullscreen)
        await dialog.current.requestFullscreen();
      else
        setError(
          "Tela cheia indisponível neste navegador. A apresentação continua nesta janela.",
        );
    } catch {
      setError(
        "Não foi possível abrir em tela cheia. A apresentação continua nesta janela.",
      );
    }
  }
  const celebrate =
    !reduceMotion &&
    confetti &&
    !clock.done &&
    ["winner", "finale"].includes(phase.kind);
  const liveMessage = phase.rank
    ? `${phase.rank}º lugar: ${
        groups
          .find((group) => group.rank === phase.rank)
          ?.projects.map(
            (project) => `${project.name}, nota ${scoreText(project)}`,
          )
          .join("; ") ?? ""
      }`
    : "";
  return (
    <dialog
      ref={dialog}
      className="ceremony-dialog"
      aria-labelledby={`${id}-title`}
      onCancel={() => sound.current?.dispose()}
      onClose={onClose}
    >
      <div
        className={`ceremony ${preferences.calm ? "ceremony-calm" : ""}`}
        data-phase={phase.kind}
        data-paused={clock.paused}
      >
        <header className="ceremony-header">
          <div>
            <span className="ceremony-brand">
              <Trophy size={18} aria-hidden="true" />
              NEXUS · PREMIAÇÃO
            </span>
            <h2 id={`${id}-title`}>{result.name}</h2>
          </div>
          <div className="ceremony-header-actions">
            {!clock.done && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => clock.setPaused((value) => !value)}
                  aria-pressed={clock.paused}
                  aria-label={clock.paused ? "Continuar" : "Pausar"}
                  title={clock.paused ? "Continuar" : "Pausar"}
                  size="icon"
                >
                  {clock.paused ? <Play size={16} /> : <Pause size={16} />}{" "}
                </Button>
                <Button
                  variant="ghost"
                  onClick={toggleMusic}
                  disabled={loadingMusic}
                >
                  {music ? <VolumeX size={16} /> : <Music2 size={16} />}{" "}
                  {loadingMusic
                    ? "Carregando música…"
                    : music
                      ? "Silenciar música"
                      : "Ativar música"}
                </Button>
              </>
            )}
            <Button
              autoFocus
              variant="ghost"
              size="icon"
              onClick={() => dialog.current?.close()}
              aria-label="Fechar premiação"
            >
              <X size={20} />
            </Button>
          </div>
        </header>
        <div
          className="ceremony-progress"
          role="progressbar"
          aria-label="Andamento da premiação"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((clock.elapsed / duration) * 100)}
        >
          <span style={{ width: `${(clock.elapsed / duration) * 100}%` }} />
        </div>
        {preferences.captions && (
          <div className="ceremony-captions" role="status" aria-live="polite" aria-atomic="true">
            <span className="ceremony-captions-tag">LEGENDAS</span>
            <p>
              <strong>{phase.title}.</strong> {phase.detail}{" "}
              {phase.rank
                ? ` ${liveMessage}`
                : clock.done
                  ? " Premiação concluída. Você pode rever ou fechar."
                  : ""}
            </p>
          </div>
        )}
        <div
          className="ceremony-announcement"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="sr-only">{liveMessage}</span>
          <div>
            <p className="ceremony-eyebrow">
              {clock.done
                ? "UMA JORNADA PARA CELEBRAR"
                : clock.paused
                  ? "APRESENTAÇÃO PAUSADA"
                  : phase.kind === "suspense"
                    ? "O GRANDE MOMENTO"
                    : "RECONHECIMENTO A QUEM TRANSFORMA"}
            </p>
            <motion.h3
              key={phase.start}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.5 }}
            >
              {phase.title}
            </motion.h3>
            <p>{phase.detail}</p>
          </div>
        </div>
        <div
          className="ceremony-stage"
          aria-label="Pódio de projetos premiados"
        >
          <div className="ceremony-halo" aria-hidden="true" />
          {[2, 1, 3].map((rank) => {
            const group = groups.find((item) => item.rank === rank);
            if (!group) return null;
            const revealed = shown.includes(rank);
            return (
              <motion.section
                key={rank}
                className={`award-column award-rank-${rank} ${revealed ? "award-revealed" : "award-hidden"}`}
                aria-label={`${rank}º lugar`}
                style={{ gridColumn: rank === 1 ? 2 : rank === 2 ? 1 : 3 }}
                initial={false}
                animate={{
                  opacity: revealed ? 1 : 0.38,
                  y: revealed || reduceMotion ? 0 : 16,
                }}
                transition={{
                  duration: reduceMotion ? 0 : 0.75,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {revealed ? (
                  <div className="award-names">
                    {rank === 1 && (
                      <Trophy
                        className="award-trophy"
                        size={38}
                        aria-hidden="true"
                      />
                    )}
                    <span className="award-caption">
                      {group.projects.length > 1
                        ? "CONQUISTA COMPARTILHADA"
                        : rank === 1
                          ? "PRIMEIRO LUGAR"
                          : "DESTAQUE DA BANCA"}
                    </span>
                    <ul>
                      {group.projects.map((project) => (
                        <li key={project.id}>
                          <strong>{project.name}</strong>
                          <span>
                            {scoreText(project)} <small>/ 5</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                    {group.projects.length > 1 && (
                      <span className="award-tie">
                        Empate · {group.projects.length} projetos
                      </span>
                    )}
                  </div>
                ) : (
                  <div
                    className="award-mystery"
                    aria-label="Projeto ainda não revelado"
                  >
                    <Sparkles size={23} aria-hidden="true" />
                    <span>Em instantes</span>
                  </div>
                )}
                <div className="award-block" aria-hidden="true">
                  <span>
                    {rank}
                    <small>º</small>
                  </span>
                  <i />
                </div>
              </motion.section>
            );
          })}
        </div>
        {celebrate && (
          <div
            className="ceremony-confetti"
            aria-hidden="true"
            key={`confetti-${clock.iteration}`}
          >
            {Array.from({ length: 48 }, (_, index) => (
              <i
                key={index}
                style={{
                  left: `${(index * 37) % 100}%`,
                  background: ["#a4e3d1", "#f4d18a", "#f1f8f6"][index % 3],
                  animationDelay: `${(index % 8) * 0.12}s`,
                  animationDuration: `${3.4 + (index % 5) * 0.35}s`,
                  transform: `rotate(${index * 31}deg)`,
                  animationPlayState: clock.paused ? "paused" : "running",
                }}
              />
            ))}
          </div>
        )}
        <footer className="ceremony-controls">
          {!clock.done && (
            <p className="ceremony-sound-note">
              {music
                ? "Trilha instrumental ativada."
                : "A apresentação começou sem som. Ative a música se desejar."}
            </p>
          )}
          <div className="ceremony-control-row">
            {music && !clock.done && (
              <label className="ceremony-volume">
                Volume
                <input
                  aria-label="Volume da música"
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                />
              </label>
            )}
            <Button
              variant="ghost"
              onClick={toggleFullscreen}
              aria-pressed={fullscreen}
            >
              {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}{" "}
              {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => update({ calm: !preferences.calm })}
              aria-pressed={preferences.calm}
            >
              {preferences.calm && <Check size={16} />} Modo tranquilo
            </Button>
            {!reduceMotion && (
              <Button
                variant="ghost"
                onClick={() => setConfetti((value) => !value)}
                aria-pressed={confetti}
              >
                {confetti ? "Desativar confetes" : "Ativar confetes"}
              </Button>
            )}
            {clock.done ? (
              <Button onClick={replay}>
                <RotateCcw size={16} />
                Rever premiação
              </Button>
            ) : (
              <Button onClick={clock.skip}>
                Ver resultado agora
                <ChevronRight size={16} />
              </Button>
            )}
            <Button asChild variant="ghost">
              <Link
                href={`/app/results?banca=${encodeURIComponent(result.event_id)}`}
              >
                Consultar classificação
              </Link>
            </Button>
          </div>
          {error && (
            <p className="ceremony-error" role="alert">
              {error}
            </p>
          )}
          <p className="ceremony-personal-note">
            Uma celebração no seu ritmo. Sua reprodução não interfere na de
            outras pessoas.
          </p>
        </footer>
      </div>
    </dialog>
  );
}
