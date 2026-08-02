export function shouldAcceptMutation(current: { updatedAt: Date; revisionKey: string } | undefined, incoming: { updatedAt: Date; revisionKey: string }): boolean {
  if (!current) return true;
  if (incoming.updatedAt.getTime() !== current.updatedAt.getTime()) return incoming.updatedAt > current.updatedAt;
  return incoming.revisionKey > current.revisionKey;
}
