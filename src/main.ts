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
    isAnimating: boolean;
    haveStarsFallen: boolean;
    viewport: {
        x1: number;
        x2: number;
        y1: number;
        y2: number;
    };
    glyphCache: GlyphCache;
    image: {
        width: number;
        height: number;
        numberOfCols: number;
    };
    data: DataPoint[];
    canvas: {
        element: HTMLCanvasElement;
        ctx: CanvasRenderingContext2D;
    };
};

type CustomWindow = typeof globalThis & { state: State };

const CHAR_COLOR = "yellow";
const CONTAINER_LARGE = "container-large";
const CONTAINER_SMALL = "container-small";

await main();

async function main() {
    const { numberOfCols, numberOfRows, data, charSet } = await getData();

    const imageWidth = 1024;
    const imageHeight = (imageWidth * numberOfRows) / numberOfCols;
    const image = {
        width: imageWidth,
        height: imageHeight,
        numberOfCols,
    };

    const canvas = createCanvas();

    const canvasWidth = imageWidth * 6;
    const size = canvasWidth / numberOfCols;
    canvas.element.width = numberOfCols * size;
    canvas.element.height = numberOfRows * size;
    canvas.ctx.textBaseline = "top";
    canvas.ctx.fillStyle = CHAR_COLOR;

    const viewport = getViewportDimensions(canvas.element);

    const glyphCache = buildGlyphCache(
        Array.from(charSet),
        "monospace",
        CHAR_COLOR,
        10,
    );

    initState({
        animateBlinking: true,
        isAnimating: false,
        haveStarsFallen: false,
        viewport,
        glyphCache,
        image,
        data,
        canvas,
    });

    createButton(size);
    animateBlinking(size);
}

function getState(): State {
    return (window as unknown as CustomWindow).state;
}

function initState(state: State): void {
    (window as unknown as CustomWindow).state = state;
}

function createButton(size: number): void {
    const button = document.createElement("button");

    button.innerHTML = "God how the stars did fall.";
    button.id = "star-fall";
    button.addEventListener("click", () => {
        const state = getState();
        if (state.isAnimating) {
            return;
        }
        state.isAnimating = true;
        state.animateBlinking = false;
        animateStarFall(size, state.haveStarsFallen ? "out" : "in");
    });
    document.body.appendChild(button);
}

function getViewportDimensions(canvas: HTMLCanvasElement) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const x1 = (canvas.width - windowWidth) / 2;
    const y1 = (canvas.height - windowHeight) / 2;
    const x2 = x1 + windowWidth;
    const y2 = y1 + windowHeight;

    return {
        x1,
        x2,
        y1,
        y2,
    };
}

function createCanvas(): {
    element: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
} {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("failed to get context");

    return {
        element: canvas,
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

function animateBlinking(size: number) {
    const { canvas } = getState();
    let start: undefined | number;

    const step = (ts: number) => {
        if (!getState().animateBlinking) {
            return;
        }

        if (start === undefined) start = ts;

        const elapsed = (ts - start) / 1000;

        canvas.ctx.clearRect(0, 0, canvas.element.width, canvas.element.height);

        draw(size, 0, 0, elapsed);

        requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
}

function fadeIn(id: string) {
    const el = document.getElementById(id) as HTMLDivElement;
    el.className = "fade-in";
}

function fadeOut(id: string) {
    const el = document.getElementById(id) as HTMLDivElement;
    el.className = "fade-out";
}

function animateStarFall(size: number, direction: "in" | "out") {
    const { image, data, canvas } = getState();

    fadeOut(direction === "in" ? CONTAINER_LARGE : CONTAINER_SMALL);

    setTimeout(() => {
        fadeIn(direction === "in" ? CONTAINER_SMALL : CONTAINER_LARGE);
    }, 2000);

    for (const el of data) {
        el.visible = true;
    }

    const timeInMs = 2 * 1000;
    let start: undefined | number;

    const targetXOffset = canvas.element.width / 2 - image.width / 2;
    const targetYOffset = canvas.element.height / 2 - image.height / 2;
    const targetSize = image.width / image.numberOfCols;

    const step = (ts: number) => {
        if (start === undefined) start = ts;

        const elapsed = ts - start;
        if (elapsed > timeInMs) {
            const state = getState();
            state.isAnimating = false;
            state.haveStarsFallen = !state.haveStarsFallen;
            return;
        }

        const progress =
            direction === "in"
                ? easeOutCirc(elapsed / timeInMs)
                : 1 - easeOutCirc(elapsed / timeInMs);

        const currentSize = interpolate(size, targetSize, progress);
        const currentXOffset = progress * targetXOffset;
        const currentYOffset = progress * targetYOffset;

        canvas.ctx.clearRect(0, 0, canvas.element.width, canvas.element.height);

        draw(currentSize, currentXOffset, currentYOffset);

        requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
}

function interpolate(start: number, end: number, progress: number): number {
    return start + progress * (end - start);
}

function easeOutCirc(x: number): number {
    return Math.sqrt(1 - Math.pow(x - 1, 2));
}

function draw(size: number, xOffset: number, yOffset: number, time?: number) {
    const { viewport, data, glyphCache, canvas, image } = getState();
    console.log(getState());

    let row = 0;
    let col = 0;

    for (const el of data) {
        const x = col * size + xOffset;
        const y = row * size + yOffset;

        const outOfBounds =
            x < viewport.x1 ||
            x > viewport.x2 ||
            y < viewport.y1 ||
            y > viewport.y2;

        if (!outOfBounds && el.visible) {
            const alpha = time
                ? 0.25 * Math.sin(el.frequency * time) + 0.75
                : null;
            const charSize = time ? 2 * Math.sin(el.frequency * time) + 8 : 10;

            canvas.ctx.globalAlpha = alpha ?? 1;
            canvas.ctx.drawImage(
                glyphCache.get(el.char)!,
                x,
                y,
                charSize,
                charSize,
            );
        }

        if (col == image.numberOfCols - 1) {
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
