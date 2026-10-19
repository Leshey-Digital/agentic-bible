import {commandInput, type Command, type Publish, type Rollback, type Receipt} from '../publishing/contracts.ts';
import {assessQuality, requireQualityAllow} from './admission.ts';
import type {QualityControl, QualityReceipt, QualitySource} from './contracts.ts';
import type {SqlDatabase} from '../editorial/contracts.ts';
import type {PublicationStore} from '../publishing/store.ts';

export type QualityPublicationContext={
  db:SqlDatabase;
  quality:QualityControl;
  sources:QualitySource[];
  publisher:Pick<PublicationStore,'execute'>;
};

export type QualityPublicationResult=
  | {action:'publish';quality:QualityReceipt;publication:Receipt}
  | {action:'rollback';publication:Receipt};

/**
 * The controlled article lifecycle boundary: a publish command is structurally
 * validated, durably assessed against its exact candidate and source bytes, and
 * reaches the isolated publisher only after a trusted allow receipt. The
 * publisher retains its own replay, capacity, rollback, metadata and history
 * guarantees. This function does not write canonical Markdown or Git history.
 */
export async function executeQualityPublication(value:unknown,context:QualityPublicationContext):Promise<QualityPublicationResult>{
  const command:Command=commandInput(value);
  if(command.kind==='rollback'){
    const publication=await context.publisher.execute(command satisfies Rollback);
    return {action:'rollback',publication};
  }
  const publish=command satisfies Publish;
  const quality=await assessQuality(publish.eventId,publish.article,context.sources,{db:context.db,quality:context.quality});
  requireQualityAllow(quality);
  const publication=await context.publisher.execute(publish);
  return {action:'publish',quality,publication};
}
