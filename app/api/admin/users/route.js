import { loadJsonStore } from '../../../../lib/blobJsonStore';

function computeStage(member) {
  if (member.onboardingComplete === true) return 'Onboarding Complete';
  if (member.contractingStarted === true && !member.contractingComplete) return 'Contracting';
  if (member.contractingComplete === true && !member.onboardingComplete) return 'Contracting Done';
  if (member.schoolCommunityJoined === true && !member.contractingStarted) return 'Community';
  if (member.youtubeCommentApproved === true && !member.schoolCommunityJoined) return 'YouTube';
  if (member.communityServiceApproved === true && !member.youtubeCommentApproved) return 'Service';
  return 'Just Joined';
}

export async function GET() {
  const members = await loadJsonStore('stores/sponsorship-program-members.json', []);
  const rows = members.map((m) => ({ ...m, stage: computeStage(m) }));
  return Response.json({ ok: true, rows });
}
