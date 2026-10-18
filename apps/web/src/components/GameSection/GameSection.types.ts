export interface GameSectionProps {
  /** The still-encoded `[gId]` segment, alongside any others the route has. */
  params: Promise<{ gId: string }>;
}
