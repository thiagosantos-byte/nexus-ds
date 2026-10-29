import { Link } from "wouter";
import { ArrowRight, Trophy } from "lucide-react";
import type { Result } from "../workspace/types";
import { canCelebrate } from "./model";
import { useCeremonySeen } from "./seen";
export function NewResultsNotice({
  results,
  userId,
  institutionId,
}: {
  results: Result[];
  userId: string;
  institutionId: string;
}) {
  const seen = useCeremonySeen(userId, institutionId);
  const fresh = results.filter(
    (result) => canCelebrate(result) && !seen(result),
  );
  if (!fresh.length) return null;
  return (
    <aside
      className="notice podium-new-result"
      aria-label="Novo resultado publicado"
    >
      <Trophy size={23} aria-hidden="true" />
      <div>
        <strong>Seu próximo momento de celebração chegou.</strong>
        <p>
          {fresh[0].name}
          {fresh.length > 1
            ? ` · mais ${fresh.length - 1} resultados para conhecer`
            : " · resultado publicado"}
        </p>
      </div>
      <Link
        className="btn btn-primary"
        href={`/app/podium?banca=${encodeURIComponent(fresh[0].event_id)}`}
      >
        Assistir à premiação
        <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </aside>
  );
}
