import "./style.css";

await main();

async function main() {
    const res = await fetch("/image.data");
    if (!res.body) throw new Error("no response body");

    const data = await res.text();
    const splitIndex = data.indexOf("\n");
    if (splitIndex === -1) throw new Error("expected new line in data");

    const [width, height] = data
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

    const imageWidth = 1024;
    const fontSize = imageWidth / width;
    const charWidth = fontSize * 1.0;
    const lineHeight = fontSize * 1.0;

    canvas.width = width * charWidth;
    canvas.height = height * lineHeight;

    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = "top";
    ctx.fillStyle = "yellow";

    let y = 0;
    let x = 0;
    let i = splitIndex + 1;

    while (i < data.length) {
        let countString = "";
        while (data[i] >= "0" && data[i] <= "9") {
            countString += data[i];
            i++;
            if (i == data.length)
                throw new Error("reached end while parsing number");
        }

        let count = parseInt(countString);
        if (Number.isNaN(count)) throw new Error("invalid count number");
        const char = data[i++];

        while (count-- > 0) {
            ctx.fillText(char, x * charWidth, y * lineHeight);

            if (x == width - 1) {
                y++;
                x = 0;
            } else {
                x++;
            }
        }
    }
}
