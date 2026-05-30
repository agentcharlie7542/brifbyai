import { eq, desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import type {
  Influencer,
  NewInfluencer,
  InfluencerProposal,
  NewInfluencerProposal,
} from '@/db/schema';

// ── influencers ──────────────────────────────────────────────
export async function listInfluencersByBrand(
  brandId: string
): Promise<Influencer[]> {
  return db
    .select()
    .from(schema.influencers)
    .where(eq(schema.influencers.brandId, brandId))
    .orderBy(desc(schema.influencers.updatedAt));
}

export async function getInfluencer(id: string): Promise<Influencer | null> {
  const rows = await db
    .select()
    .from(schema.influencers)
    .where(eq(schema.influencers.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createInfluencer(
  input: NewInfluencer
): Promise<Influencer> {
  const [created] = await db
    .insert(schema.influencers)
    .values(input)
    .returning();
  return created;
}

export async function updateInfluencer(
  id: string,
  patch: Partial<NewInfluencer>
): Promise<Influencer | null> {
  const [updated] = await db
    .update(schema.influencers)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.influencers.id, id))
    .returning();
  return updated ?? null;
}

// ── influencer_proposals ─────────────────────────────────────
export async function listProposalsBySheet(
  sheetId: string
): Promise<
  Array<
    InfluencerProposal & {
      influencerName: string | null;
      influencerHandle: string | null;
      influencerPlatform: string | null;
    }
  >
> {
  return db
    .select({
      id: schema.influencerProposals.id,
      sheetId: schema.influencerProposals.sheetId,
      influencerId: schema.influencerProposals.influencerId,
      content: schema.influencerProposals.content,
      yakkihouSummary: schema.influencerProposals.yakkihouSummary,
      status: schema.influencerProposals.status,
      createdById: schema.influencerProposals.createdById,
      createdAt: schema.influencerProposals.createdAt,
      updatedAt: schema.influencerProposals.updatedAt,
      influencerName: schema.influencers.displayName,
      influencerHandle: schema.influencers.handle,
      influencerPlatform: schema.influencers.platform,
    })
    .from(schema.influencerProposals)
    .leftJoin(
      schema.influencers,
      eq(schema.influencerProposals.influencerId, schema.influencers.id)
    )
    .where(eq(schema.influencerProposals.sheetId, sheetId))
    .orderBy(desc(schema.influencerProposals.updatedAt));
}

export async function getProposal(
  id: string
): Promise<InfluencerProposal | null> {
  const rows = await db
    .select()
    .from(schema.influencerProposals)
    .where(eq(schema.influencerProposals.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createProposal(
  input: NewInfluencerProposal
): Promise<InfluencerProposal> {
  const [created] = await db
    .insert(schema.influencerProposals)
    .values(input)
    .returning();
  return created;
}

export async function updateProposal(
  id: string,
  patch: Partial<NewInfluencerProposal>
): Promise<InfluencerProposal | null> {
  const [updated] = await db
    .update(schema.influencerProposals)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.influencerProposals.id, id))
    .returning();
  return updated ?? null;
}
