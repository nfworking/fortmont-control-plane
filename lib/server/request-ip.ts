function normalizeIp(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    if (end > 1) {
      return trimmed.slice(1, end);
    }
  }

  const colonCount = (trimmed.match(/:/g) ?? []).length;
  if (colonCount === 1 && trimmed.includes(".")) {
    return trimmed.split(":")[0] ?? null;
  }

  return trimmed;
}

function pickForwardedFor(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.trim();
  if (!forwardedFor) {
    return null;
  }

  const first = forwardedFor.split(",")[0] ?? "";
  return normalizeIp(first);
}

export function getRequestPublicIp(headers: Headers) {
  const fromForwardedFor = pickForwardedFor(headers);
  if (fromForwardedFor) {
    return fromForwardedFor;
  }

  const fromRealIp = normalizeIp(headers.get("x-real-ip") ?? "");
  if (fromRealIp) {
    return fromRealIp;
  }

  const fromCf = normalizeIp(headers.get("cf-connecting-ip") ?? "");
  if (fromCf) {
    return fromCf;
  }

  return null;
}
