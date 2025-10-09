// ...existing imports and state...

async function savePreview(payload: {
  provider: string;
  profile: string;
  rows: { symbol: string; weight: number }[];
  grade_base: number;
  grade_adjusted: number;
}) {
  const res = await fetch("/api/preview/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data?.id) throw new Error(data?.error || "Failed to save preview");
  // Persist for checkout:
  localStorage.setItem("gy4k_preview_id", data.id as string);
  return data.id as string;
}

function computeGrade(profileInput: InvestorProfile, totalWeight: number): number {
  const base = profileInput === "Aggressive Growth" ? 4.5 : profileInput === "Balanced" ? 3.8 : 4.1;
  const penalty = Math.min(1, Math.abs(100 - totalWeight) / 100);
  const grade = Math.max(1, Math.min(5, Math.round((base - penalty) * 2) / 2));
  return grade;
}

async function submit() {
  const grade = computeGrade(profile, total);
  try {
    const previewId = await savePreview({
      provider,
      profile,
      rows,
      grade_base: grade,
      grade_adjusted: grade, // (you can adjust later with market overlay)
    });
    const params = new URLSearchParams({
      provider,
      profile,
      grade: grade.toFixed(1),
      previewId,
    });
    router.push(`/grade/result?${params.toString()}`);
  } catch (e) {
    alert("Could not save your grade. Please try again.");
  }
}
