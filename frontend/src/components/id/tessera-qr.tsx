"use client";

import { memo, useMemo } from "react";
import qrcode from "qrcode-generator";

const QUIET_ZONE_MODULES = 4; // ID: "four clear modules on every side, never reduced"
const CORNER_RADIUS_FRACTION = 0.45; // ID-6: 45% of a module's width
const FINDER_SIZE = 7; // fixed by the QR spec, not this payload's size
const FINDER_OUTER_RADIUS_FRACTION = 0.3;

type Cell = { row: number; col: number };

function inFinderZone(row: number, col: number, moduleCount: number): boolean {
  const last = moduleCount - FINDER_SIZE;
  const inTopLeft = row < FINDER_SIZE && col < FINDER_SIZE;
  const inTopRight = row < FINDER_SIZE && col >= last;
  const inBottomLeft = row >= last && col < FINDER_SIZE;
  return inTopLeft || inTopRight || inBottomLeft;
}

// Per-corner radii in path order [top-left, top-right, bottom-right, bottom-left].
function roundedRectPath(x: number, y: number, size: number, radii: [number, number, number, number]): string {
  const [tl, tr, br, bl] = radii;
  return [
    `M ${x + tl} ${y}`,
    `H ${x + size - tr}`,
    tr > 0 ? `A ${tr} ${tr} 0 0 1 ${x + size} ${y + tr}` : "",
    `V ${y + size - br}`,
    br > 0 ? `A ${br} ${br} 0 0 1 ${x + size - br} ${y + size}` : "",
    `H ${x + bl}`,
    bl > 0 ? `A ${bl} ${bl} 0 0 1 ${x} ${y + size - bl}` : "",
    `V ${y + tl}`,
    tl > 0 ? `A ${tl} ${tl} 0 0 1 ${x + tl} ${y}` : "",
    "Z",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildDataPath(isDark: (row: number, col: number) => boolean, moduleCount: number): string {
  const paths: string[] = [];
  const on = (r: number, c: number) => r >= 0 && c >= 0 && r < moduleCount && c < moduleCount && isDark(r, c);
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!isDark(row, col) || inFinderZone(row, col, moduleCount)) continue;
      const up = on(row - 1, col);
      const down = on(row + 1, col);
      const left = on(row, col - 1);
      const right = on(row, col + 1);
      const isolated = !up && !down && !left && !right;
      const r = CORNER_RADIUS_FRACTION;
      const radii: [number, number, number, number] = isolated
        ? [0.5, 0.5, 0.5, 0.5]
        : [up || left ? 0 : r, up || right ? 0 : r, down || right ? 0 : r, down || left ? 0 : r];
      paths.push(roundedRectPath(col, row, 1, radii));
    }
  }
  return paths.join(" ");
}

// A finder pattern is a fixed 7x7 bullseye at the QR spec's three known
// corners — rendered as three concentric shapes (outer ring, a punched-out
// light gap, then the inner block redrawn on top) rather than 24 individual
// modules, so it gets its own rounding treatment (roadmap: "30% outer
// radius, fully rounded inner block") instead of the per-module neighbour
// test the data field uses.
function buildFinderOuterPath(topLeft: Cell): string {
  const { row, col } = topLeft;
  const radius = FINDER_SIZE * FINDER_OUTER_RADIUS_FRACTION;
  return roundedRectPath(col, row, FINDER_SIZE, [radius, radius, radius, radius]);
}

export const TesseraQR = memo(function TesseraQR({ payload }: { payload: string }) {
  const { dataPath, finderOuterPath, finderInnerHolePath, moduleCount } = useMemo(() => {
    const qr = qrcode(0, "Q");
    // Alphanumeric must be explicit — addData() defaults to Byte mode,
    // which would silently triple the module count (33x33 instead of
    // 29x29) for this exact payload length. See docs/decisions.md.
    qr.addData(payload, "Alphanumeric");
    qr.make();
    const count = qr.getModuleCount();
    if (process.env.NODE_ENV !== "production" && count !== 29) {
      console.warn(`TesseraQR: expected a 29x29 code for a 33-character payload, got ${count}x${count}`);
    }

    const finders: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: count - FINDER_SIZE },
      { row: count - FINDER_SIZE, col: 0 },
    ];

    return {
      moduleCount: count,
      dataPath: buildDataPath(qr.isDark.bind(qr), count),
      finderOuterPath: finders.map((f) => buildFinderOuterPath(f)).join(" "),
      finderInnerHolePath: finders
        .map((f) => roundedRectPath(f.col + 1, f.row + 1, 5, [0.9, 0.9, 0.9, 0.9]))
        .join(" "),
    };
  }, [payload]);

  const side = moduleCount + QUIET_ZONE_MODULES * 2;

  return (
    <svg viewBox={`0 0 ${side} ${side}`} width="100%" height="100%" role="img" aria-label={payload}>
      <rect x={0} y={0} width={side} height={side} fill="var(--qr-card-bg)" />
      <g transform={`translate(${QUIET_ZONE_MODULES}, ${QUIET_ZONE_MODULES})`}>
        <path d={finderOuterPath} fill="var(--qr-ink)" />
        <path d={finderInnerHolePath} fill="var(--qr-card-bg)" />
        <path d={buildFinderInnerPaths(moduleCount)} fill="var(--qr-ink)" />
        <path d={dataPath} fill="var(--qr-ink)" />
      </g>
    </svg>
  );
});

function buildFinderInnerPaths(moduleCount: number): string {
  const finders: Cell[] = [
    { row: 0, col: 0 },
    { row: 0, col: moduleCount - FINDER_SIZE },
    { row: moduleCount - FINDER_SIZE, col: 0 },
  ];
  return finders.map((f) => roundedRectPath(f.col + 2, f.row + 2, 3, [1.5, 1.5, 1.5, 1.5])).join(" ");
}
