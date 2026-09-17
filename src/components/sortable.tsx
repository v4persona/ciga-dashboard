"use client";
import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";
export type SortState<K extends string> = { key: K; dir: SortDir };
export type Accessors<T, K extends string> = Record<K, (row: T) => number | string | null>;

/**
 * Ordenação por coluna no cliente. `accessors` deve ser uma constante de módulo (identidade estável).
 * Valores nulos vão sempre para o fim; strings comparam em pt-BR.
 */
export function useSort<T, K extends string>(rows: T[], accessors: Accessors<T, K>, initial: SortState<NoInfer<K>> | null = null) {
  const [sort, setSort] = useState<SortState<K> | null>(initial);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const get = accessors[sort.key];
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb), "pt-BR") * dir;
      return (va - vb) * dir;
    });
  }, [rows, sort, accessors]);
  const toggle = (key: K, defaultDir: SortDir) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir }));
  return { sorted, sort, toggle };
}

/** Cabeçalho clicável. Colunas numéricas começam decrescentes; texto, crescente. */
export function Th<K extends string>({ label, sortKey, sort, onSort, num, className = "" }: {
  label: string; sortKey: K; sort: SortState<K> | null; onSort: (key: K, defaultDir: SortDir) => void; num?: boolean; className?: string;
}) {
  const active = sort?.key === sortKey;
  const dir = active ? sort!.dir : null;
  return (
    <th className={`${num ? "num " : ""}${className}`} aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}>
      <button type="button" className={`th-sort ${active ? "is-active" : ""}`} onClick={() => onSort(sortKey, num ? "desc" : "asc")}>
        {label}
        <span aria-hidden className="th-sort-icon">{dir === "asc" ? "▲" : "▼"}</span>
      </button>
    </th>
  );
}
