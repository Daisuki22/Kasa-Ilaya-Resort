const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

const isLocalHostname = (hostname) => LOCAL_HOSTNAMES.has(hostname.toLowerCase());

const appBasePath = () => {
  const viteBase = import.meta.env.BASE_URL || "/";
  if (viteBase && viteBase !== "/") {
    return viteBase.endsWith("/") ? viteBase : `${viteBase}/`;
  }

  if (typeof window === "undefined") {
    return "/";
  }

  const projectMatch = window.location.pathname.match(/^\/Kasa-Ilaya-Resort(?:\/|$)/i);
  return projectMatch ? "/Kasa-Ilaya-Resort/" : "/";
};

export const resolveAssetUrl = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed || /^(data|blob):/i.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replace(/\\/g, "/");

  if (/^img\//i.test(normalized)) {
    return `${appBasePath()}${normalized}`.replace(/\/{2,}/g, "/");
  }

  if (/^\/img\//i.test(normalized) && appBasePath() !== "/") {
    return `${appBasePath()}${normalized.slice(1)}`.replace(/\/{2,}/g, "/");
  }

  if (typeof window === "undefined" || !/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    const currentUrl = new URL(window.location.href);

    if (!isLocalHostname(url.hostname) || isLocalHostname(currentUrl.hostname)) {
      return normalized;
    }

    const uploadMatch = url.pathname.match(/\/[^/]+\/api\/(uploads\/.*)$/i);
    if (import.meta.env.DEV && uploadMatch) {
      return `${currentUrl.origin}/api/${uploadMatch[1]}${url.search}${url.hash}`;
    }

    url.protocol = currentUrl.protocol;
    url.host = currentUrl.host;
    return url.toString();
  } catch {
    return normalized;
  }
};

export const resolveAssetUrlsDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map(resolveAssetUrlsDeep);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, resolveAssetUrlsDeep(entryValue)])
    );
  }

  return resolveAssetUrl(value);
};
