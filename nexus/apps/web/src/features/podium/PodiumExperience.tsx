import { lazy, Suspense, useRef, useState } from "react";
import { Link } from "wouter";
import { Play, Trophy } from "lucide-react";
import { Button } from "../../components/ui/button";
import { LoadingState } from "../../components/app-ui";
import type { Result } from "../workspace/types";
import { canCelebrate, resultVersion } from "./model";
import { useCeremonySeen } from "./seen";
import "./podium.css";
const Ceremony = lazy(() => import("./Ceremony"));
export function PodiumExperience({
  result,
  userId,
  institutionId,
}: {
  result: Result;
  userId: string;
  institutionId: string;
}) {
  const seen = useCeremonySeen(userId, institutionId);
  const [open, setOpen] = useState(() => canCelebrate(result) && !seen(result));
  const [attempt, setAttempt] = useState(0);
  const launch = useRef<HTMLButtonElement>(null);
  if (!canCelebrate(result))
    return (
      <p className="notice">
        {result.status !== "closed"
          ? "Encerre a banca antes da premiação."
          : !result.published
            ? "Publique o resultado para disponibilizar a cerimônia aos membros ativos da instituição."
            : "A premiação precisa de resultados completos e classificados. Atualize os dados ou consulte a gestão."}
      </p>
    );
  return (
    <div className="podium-entry">
      <section className="podium-invitation" aria-label="Assistir à premiação">
        <Trophy size={42} aria-hidden="true" />
        <div>
          <span className="eyebrow">PUBLICADO · PARA SUA INSTITUIÇÃO</span>
          <h3>Uma jornada. Um momento para celebrar.</h3>
          <p>
            Acompanhe a revelação dos destaques desta banca, no seu ritmo. A
            música é opcional.
          </p>
          <div className="workspace-actions">
            <Button
              ref={launch}
              onClick={() => {
                setAttempt((value) => value + 1);
                setOpen(true);
              }}
            >
              <Play size={17} aria-hidden="true" />
              {seen(result) ? "Rever premiação" : "Assistir à premiação"}
            </Button>
            <Button asChild variant="ghost">
              <Link
                href={`/app/results?banca=${encodeURIComponent(result.event_id)}`}
              >
                Consultar classificação
              </Link>
            </Button>
          </div>
        </div>
      </section>
      {open && (
        <Suspense
          fallback={
            <div className="podium-loading">
              <LoadingState>Preparando seu momento de premiação…</LoadingState>
            </div>
          }
        >
          <Ceremony
            key={`${resultVersion(result)}:${attempt}`}
            result={result}
            userId={userId}
            institutionId={institutionId}
            onClose={() => {
              setOpen(false);
              requestAnimationFrame(() => launch.current?.focus());
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
