import "./style.css";
import "./fonts.css";

type GlyphCache = Map<number, HTMLCanvasElement>;

type DataPoint = {
    char: number;
    visible: boolean;
    frequency: number;
};

type State = {
    animateBlinking: boolean;
};

type CustomWindow = typeof globalThis & { state: State };

const CHAR_COLOR = "yellow";

await main();

async function main() {
    const { numberOfCols, numberOfRows, data, charSet } = await getData();
    const { canvas, ctx } = createCanvas();

    (window as unknown as CustomWindow).state = {
        animateBlinking: true,
    };

    const imageWidth = 1024;
    const imageHeight = (imageWidth * numberOfRows) / numberOfCols;

    const canvasWidth = imageWidth * 6;

    const size = canvasWidth / numberOfCols;

    canvas.width = numberOfCols * size;
    canvas.height = numberOfRows * size;

    ctx.textBaseline = "top";
    ctx.fillStyle = CHAR_COLOR;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const windowX1 = (canvas.width - windowWidth) / 2;
    const windowY1 = (canvas.height - windowHeight) / 2;
    const windowX2 = windowX1 + windowWidth;
    const windowY2 = windowY1 + windowHeight;

    const container = document.getElementById("container") as HTMLDivElement;
    if (!container) throw new Error("container not found");

    const glyphCache = buildGlyphCache(
        Array.from(charSet),
        "monospace",
        CHAR_COLOR,
        10,
    );

    createButton(
        container,
        canvas,
        ctx,
        data,
        glyphCache,
        imageWidth,
        imageHeight,
        numberOfCols,
        size,
        windowX1,
        windowX2,
        windowY1,
        windowY2,
    );

    animateBlinking(
        canvas,
        ctx,
        data,
        glyphCache,
        numberOfCols,
        size,
        windowX1,
        windowX2,
        windowY1,
        windowY2,
    );
}

function getState(): State {
    return (window as unknown as CustomWindow).state;
}

function createButton(
    container: HTMLDivElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    data: DataPoint[],
    glyphCache: GlyphCache,
    imageWidth: number,
    imageHeight: number,
    numberOfCols: number,
    size: number,
    windowX1: number,
    windowX2: number,
    windowY1: number,
    windowY2: number,
): void {
    const button = document.createElement("button");
    button.innerHTML = "God how the stars did fall.";
    button.id = "star-fall";
    button.addEventListener("click", () => {
        getState().animateBlinking = false;
        animateStarFall(
            container,
            canvas,
            ctx,
            data,
            glyphCache,
            imageWidth,
            imageHeight,
            numberOfCols,
            size,
            windowX1,
            windowX2,
            windowY1,
            windowY2,
        );
    });
    document.body.appendChild(button);
}

function createCanvas(): {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
} {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("failed to get context");

    return {
        canvas,
        ctx,
    };
}

async function getData(): Promise<{
    numberOfCols: number;
    numberOfRows: number;
    data: DataPoint[];
    charSet: Set<string>;
}> {
    const res = await fetch("/image.data");
    if (!res.body) throw new Error("no response body");

    const text = await res.text();

    const splitIndex = text.indexOf("\n");
    if (splitIndex === -1) throw new Error("expected new line in data");

    const [numberOfCols, numberOfRows] = text
        .slice(0, splitIndex)
        .split(",")
        .map((val) => {
            const num = Number.parseInt(val);
            if (Number.isNaN(num)) throw new Error("invalid dimension number");
            return num;
        });

    const data: DataPoint[] = [];
    const charSet: Set<string> = new Set();

    let cursor = splitIndex + 1;

    while (cursor < text.length) {
        let countString = "";
        while (text[cursor] >= "0" && text[cursor] <= "9") {
            countString += text[cursor];
            cursor++;
            if (cursor == text.length) {
                throw new Error("reached end while parsing number");
            }
        }

        let count = parseInt(countString);
        if (Number.isNaN(count)) throw new Error("invalid count number");

        const char = text[cursor++];
        const val = char.charCodeAt(0);

        charSet.add(char);

        for (let i = 0; i < count; i++) {
            const seed = Math.random();

            data.push({
                char: val,
                visible: seed > 0.8,
                frequency: seed * 4,
            });
        }
    }

    return {
        numberOfCols,
        numberOfRows,
        data,
        charSet,
    };
}

function animateBlinking(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    data: DataPoint[],
    glyphCache: GlyphCache,
    numberOfCols: number,
    size: number,
    windowX1: number,
    windowX2: number,
    windowY1: number,
    windowY2: number,
) {
    let start: undefined | number;

    const step = (ts: number) => {
        if (!getState().animateBlinking) return;
        if (start === undefined) start = ts;

        const elapsed = (ts - start) / 1000;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        draw(
            ctx,
            data,
            glyphCache,
            size,
            numberOfCols,
            0,
            0,
            windowX1,
            windowX2,
            windowY1,
            windowY2,
            elapsed,
        );

        requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
}

function animateStarFall(
    container: HTMLDivElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    data: DataPoint[],
    glyphCache: GlyphCache,
    imageWidth: number,
    imageHeight: number,
    numberOfCols: number,
    size: number,
    windowX1: number,
    windowX2: number,
    windowY1: number,
    windowY2: number,
) {
    for (const el of data) {
        el.visible = true;
    }

    const timeInMs = 2 * 1000;
    let start: undefined | number;

    const targetXOffset = canvas.width / 2 - imageWidth / 2;
    const targetYOffset = canvas.height / 2 - imageHeight / 2;
    const targetSize = imageWidth / numberOfCols;

    const startTop = 50;
    const startRight = 50;
    const targetTop = 0;
    const targetRight = 0;

    const step = (ts: number) => {
        if (start === undefined) start = ts;

        const elapsed = ts - start;
        if (elapsed > timeInMs) return;

        const progress = easeOutCirc(elapsed / timeInMs);

        const currentSize = targetSize + (1 - progress) * (size - targetSize);
        const currentXOffset = progress * targetXOffset;
        const currentYOffset = progress * targetYOffset;

        const currentTop = targetTop + (1 - progress) * (startTop - targetTop);
        const currentRight =
            targetRight + (1 - progress) * (startRight - targetRight);

        container.style.top = `${currentTop}%`;
        container.style.right = `${currentRight}%`;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        draw(
            ctx,
            data,
            glyphCache,
            currentSize,
            numberOfCols,
            currentXOffset,
            currentYOffset,
            windowX1,
            windowX2,
            windowY1,
            windowY2,
        );

        requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
}

function easeOutCirc(x: number): number {
    return Math.sqrt(1 - Math.pow(x - 1, 2));
}

function draw(
    ctx: CanvasRenderingContext2D,
    data: DataPoint[],
    glyphCache: GlyphCache,
    size: number,
    numberOfCols: number,
    xOffset: number,
    yOffset: number,
    windowX1: number,
    windowX2: number,
    windowY1: number,
    windowY2: number,
    time?: number,
) {
    let row = 0;
    let col = 0;

    for (const el of data) {
        const x = col * size + xOffset;
        const y = row * size + yOffset;

        const outOfBounds =
            x < windowX1 || x > windowX2 || y < windowY1 || y > windowY2;

        if (!outOfBounds && el.visible) {
            const alpha = time
                ? 0.25 * Math.sin(el.frequency * time) + 0.75
                : null;
            const charSize = time ? 2 * Math.sin(el.frequency * time) + 8 : 10;

            ctx.globalAlpha = alpha ?? 1;
            ctx.drawImage(glyphCache.get(el.char)!, x, y, charSize, charSize);
        }

        if (col == numberOfCols - 1) {
            row++;
            col = 0;
        } else {
            col++;
        }
    }
}

function buildGlyphCache(
    chars: string[],
    font: string,
    fillStyle: string,
    cellSize: number,
): GlyphCache {
    const cache = new Map<number, HTMLCanvasElement>();

    for (const char of chars) {
        const glyphCanvas = document.createElement("canvas");
        glyphCanvas.width = cellSize;
        glyphCanvas.height = cellSize;

        const gctx = glyphCanvas.getContext("2d")!;
        gctx.font = font;
        gctx.textBaseline = "top";
        gctx.fillStyle = fillStyle;
        gctx.fillText(char, 0, 0);

        cache.set(char.charCodeAt(0), glyphCanvas);
    }

    return cache;
}
