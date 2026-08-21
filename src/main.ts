import "./style.css";

await main();

async function main() {
    const res = await fetch("/image.data");
    if (!res.body) throw new Error("no response body");

    const data = await res.text();
    const instructions: (number | string)[] = [];
    const chars: Set<string> = new Set();

    const splitIndex = data.indexOf("\n");
    if (splitIndex === -1) throw new Error("expected new line in data");

    let i = splitIndex + 1;

    while (i < data.length) {
        let countString = "";
        while (data[i] >= "0" && data[i] <= "9") {
            countString += data[i];
            i++;
            if (i == data.length) {
                throw new Error("reached end while parsing number");
            }
        }

        let count = parseInt(countString);
        if (Number.isNaN(count)) throw new Error("invalid count number");

        const char = data[i++];

        chars.add(char);
        instructions.push(count);
        instructions.push(char);
    }

    const [numberOfCols, numberOfRows] = data
        .slice(0, splitIndex)
        .split(",")
        .map((val) => {
            const num = Number.parseInt(val);
            if (Number.isNaN(num)) throw new Error("invalid dimension number");
            return num;
        });

    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("failed to get context");

    const glyphCache = buildGlyphCache(
        Array.from(chars),
        "monospace",
        "yellow",
        10,
    );

    const imageWidth = 1024;
    const imageHeight = (imageWidth * numberOfRows) / numberOfCols;

    const canvasWidth = imageWidth * 6;

    const size = canvasWidth / numberOfCols;
    const targetSize = imageWidth / numberOfCols;

    canvas.width = numberOfCols * size;
    canvas.height = numberOfRows * size;

    const targetXOffset = canvas.width / 2 - imageWidth / 2;
    const targetYOffset = canvas.height / 2 - imageHeight / 2;

    ctx.font = "10px monospace";
    ctx.textBaseline = "top";
    ctx.fillStyle = "yellow";

    const timeInMs = 2 * 1000;
    let start: undefined | number;

    const animate = false;

    const step = (ts: number) => {
        if (start === undefined) start = ts;

        const elapsed = ts - start;
        if (elapsed > timeInMs) return;

        const progress = easeOutCirc(elapsed / timeInMs);
        const currentSize = targetSize + (1 - progress) * (size - targetSize);
        const currentXOffset = progress * targetXOffset;
        const currentYOffset = progress * targetYOffset;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        draw(
            ctx,
            instructions,
            glyphCache,
            currentSize,
            numberOfCols,
            currentXOffset,
            currentYOffset,
        );

        if (!animate) return;

        requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
}

function easeOutCirc(x: number): number {
    return Math.sqrt(1 - Math.pow(x - 1, 2));
}

function draw(
    ctx: CanvasRenderingContext2D,
    instructions: (number | string)[],
    glyphCache: Map<string, HTMLCanvasElement>,
    size: number,
    numberOfCols: number,
    xOffset: number,
    yOffset: number,
) {
    let y = 0;
    let x = 0;

    for (let i = 0; i < instructions.length - 1; i += 2) {
        let count = instructions[i] as number;
        const char = instructions[i + 1] as string;

        while (count-- > 0) {
            ctx.drawImage(
                glyphCache.get(char)!,
                x * size + xOffset,
                y * size + yOffset,
            );

            if (x == numberOfCols - 1) {
                y++;
                x = 0;
            } else {
                x++;
            }
        }
    }
}

function buildGlyphCache(
    chars: string[],
    font: string,
    fillStyle: string,
    cellSize: number,
): Map<string, HTMLCanvasElement> {
    const cache = new Map<string, HTMLCanvasElement>();

    for (const char of chars) {
        const glyphCanvas = document.createElement("canvas");
        glyphCanvas.width = cellSize;
        glyphCanvas.height = cellSize;

        const gctx = glyphCanvas.getContext("2d")!;
        gctx.font = font;
        gctx.textBaseline = "top";
        gctx.fillStyle = fillStyle;
        gctx.fillText(char, 0, 0);

        cache.set(char, glyphCanvas);
    }

    return cache;
}
