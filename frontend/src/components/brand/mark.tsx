// The Tessera logo mark. Verbatim from the design source (Mark.dc.html /
// mark-src.svg) — currentColor, square viewBox, no design-token dependency.
const GLYPH_PATH =
  "M476.5 1000.0C449.1 994.3,430.7 964.6,427.8 921.8C424.7 874.8,424.6 863.9,427.5 840.5C429.5 824.2,429.9 804.5,428.5 799.3C426.6 793.0,424.2 792.4,410.9 794.8C362.1 803.8,350.0 747.5,380.1 651.0C391.2 615.1,393.3 607.6,398.7 583.1C400.6 574.3,403.4 561.9,405.0 555.4C415.1 512.9,410.0 486.4,387.4 465.0C369.1 447.7,349.5 448.0,309.6 466.3C302.9 469.4,293.8 473.5,289.5 475.4C285.2 477.3,273.1 483.1,262.7 488.4C208.1 515.6,162.1 529.3,125.0 529.3C76.1 529.3,51.0 479.4,80.3 440.5C109.8 401.3,205.6 354.1,280.8 341.8C331.5 333.4,352.5 333.5,402.8 342.0C439.2 348.1,447.5 348.4,456.5 343.9C467.6 338.3,470.2 324.3,463.0 309.4C460.7 304.7,459.9 303.5,447.0 284.4C427.3 255.1,421.6 232.3,419.5 173.4C417.5 116.2,422.0 90.5,440.7 53.2C466.9 0.8,507.5 -22.3,534.2 0.0C550.5 13.6,552.9 35.3,542.9 77.8C537.6 99.9,537.1 103.5,535.3 126.6C534.7 135.7,533.5 148.5,532.8 155.0C525.1 225.9,539.0 260.5,582.0 277.5C615.9 291.0,638.2 286.8,728.2 250.4C763.6 236.1,788.4 237.1,795.9 253.2C801.8 265.8,792.1 279.3,763.6 298.1C732.4 318.6,749.2 325.8,806.8 316.4C857.7 308.2,879.4 306.9,900.8 311.1C947.1 320.0,957.1 360.9,919.7 388.8C896.8 405.9,841.9 415.3,785.2 411.8C771.5 411.0,763.6 410.1,742.4 407.1C648.5 393.7,588.3 425.6,556.1 505.9C529.4 572.5,524.3 602.0,524.0 693.2C523.7 766.4,523.8 770.3,528.1 814.5C539.4 930.1,540.1 946.8,534.0 964.9C525.6 990.1,501.0 1005.1,476.5 1000.0Z";
const SPARK_PATH =
  "M716.6 849.5C692.7 846.7,689.6 828.8,706.8 793.0C732.2 740.4,732.8 719.2,710.0 687.1C694.2 664.9,690.3 655.7,690.2 641.0C690.1 622.2,699.0 607.2,727.8 577.5C757.3 547.0,779.8 536.2,797.0 544.2C813.8 552.1,816.2 571.6,804.2 602.5C791.1 636.0,791.0 644.6,803.4 667.2C809.6 678.6,814.6 689.2,816.4 694.8C833.5 747.0,789.7 830.4,736.3 847.3C731.8 848.7,729.8 849.1,722.7 849.8C721.6 849.9,718.9 849.8,716.6 849.5Z";

const BOX: Record<MarkPart, string> = {
  both: "-115 -102 1212 1212",
  glyph: "51 -22.3 906 1027",
  spark: "689.6 536.2 144 314",
  glyphInk: "68 -8 872 1006",
  sparkInk: "690.5 542 129 307",
};

const ASPECT: Record<MarkPart, number> = {
  both: 1,
  glyph: 906 / 1027,
  spark: 144 / 314,
  glyphInk: 872 / 1006,
  sparkInk: 129 / 307,
};

export type MarkPart = "both" | "glyph" | "spark" | "glyphInk" | "sparkInk";

export type MarkProps = {
  size?: number;
  part?: MarkPart;
  label?: string;
  className?: string;
};

export function Mark({ size = 28, part = "both", label = "Tessera", className }: MarkProps) {
  const resolvedPart = part === "both" && size < 20 ? "glyph" : part;
  const height = size;
  const width = Number((size * ASPECT[resolvedPart]).toFixed(1));
  const showGlyph = resolvedPart !== "spark" && resolvedPart !== "sparkInk";
  const showSpark = resolvedPart !== "glyph" && resolvedPart !== "glyphInk";
  const ariaLabel = showSpark && !showGlyph ? "" : label;

  return (
    <span
      className={className}
      style={{ display: "inline-flex", width, height, flex: "none", color: "inherit", lineHeight: 0 }}
    >
      <svg width="100%" height="100%" viewBox={BOX[resolvedPart]} fill="currentColor" role="img" aria-label={ariaLabel}>
        {showGlyph && <path id="mark-glyph" d={GLYPH_PATH} />}
        {showSpark && <path id="mark-spark" d={SPARK_PATH} />}
      </svg>
    </span>
  );
}
