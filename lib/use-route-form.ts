"use client";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Form visibility follows the URL, including refresh, Back and Forward. */
export function useRouteForm(base: string, formPath = `${base}/new`) {
  const path = usePathname(), router = useRouter(), params = useSearchParams();
  const open = path === formPath || (path.startsWith(`${base}/`) && path.endsWith('/edit'));
  function setOpen(next: boolean) {
    if (next === open) return;
    const query = params.toString();
    const suffix = query ? `?${query}` : '';
    if (next) router.push(formPath + suffix);
    else router.replace(base + suffix);
  }
  return [open, setOpen] as const;
}

export function useRouteFilter(name: string, fallback = '') {
  const path = usePathname(), router = useRouter(), params = useSearchParams();
  const value = params.get(name) || fallback;
  function setValue(next: string) {
    const query = new URLSearchParams(params.toString());
    if (!next || next === fallback) query.delete(name);
    else query.set(name, next);
    router.replace(path + (query.size ? `?${query}` : ''), {scroll:false});
  }
  return [value, setValue] as const;
}
