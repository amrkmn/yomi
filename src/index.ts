import fs from "fs/promises";
import ejs from "ejs";
import { join } from "path";
import { PathLike } from "fs";

const OUTPUT_DIR = join(process.cwd(), "dist");
const TEMPLATE_DIR = join(process.cwd(), "src/templates");
const EXTENSIONS_DIR = join(process.cwd(), "extensions");
const EXTENSIONS = ["keiyoushi", "kohi-den"];
const FILES_TO_COPY = ["index.json", "index.min.json", "repo.json", "apk", "icon"];

const owner = "amrkmn";
const repo = "yomi";
const branch = "main";

const githubAPI = `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`;

const extensions = {
    mihon: [
        {
            source: "https://github.com/keiyoushi/extensions",
            name: "Keiyoushi",
            path: "/keiyoushi/index.min.json",
        },
    ],
    aniyomi: [
        {
            source: "https://github.com/Kohi-den/extensions",
            name: "Kohi-den",
            path: "/kohi-den/index.min.json",
        },
    ],
};

async function ensureDir(path: PathLike) {
    try {
        if (!fs.exists(path)) {
            await fs.mkdir(path, { recursive: true });
        }
    } catch (error) {
        console.error(`Error creating directory ${path}:`, error);
    }
}
async function copyRecursive(src: string, dest: string) {
    try {
        const stat = await fs.stat(src);
        if (stat.isDirectory()) {
            await ensureDir(dest);
            const files = await fs.readdir(src);
            await Promise.all(files.map((file) => copyRecursive(join(src, file), join(dest, file))));
        } else {
            await fs.cp(src, dest);
        }
    } catch (err) {
        if (err.code !== "ENOENT") {
            console.error(`Error copying ${src} to ${dest}:`, err);
        }
    }
}

async function copyExtensions() {
    try {
        await ensureDir(OUTPUT_DIR);

        for (const extension of EXTENSIONS) {
            const extensionPath = join(EXTENSIONS_DIR, extension);
            const destPath = join(OUTPUT_DIR, extension);

            await ensureDir(destPath);

            for (const item of FILES_TO_COPY) {
                const srcItem = join(extensionPath, item);
                const destItem = join(destPath, item);

                await copyRecursive(srcItem, destItem);
                console.log(`Copied ${item} from ${extension} to dist/${extension}`);
            }
        }
        console.log("Submodules copied successfully to dist!");
    } catch (error) {}
}

try {
    await copyExtensions();
    const res = await fetch(githubAPI);
    const commits = await res.json();
    const latestCommitHash = `${commits.sha}`.substring(0, 7);
    const commitLink = commits.html_url;
    const source = `https://github.com/${owner}/${repo}`;

    const template = await fs.readFile(`${TEMPLATE_DIR}/index.ejs`, "utf-8");
    const output = ejs.render(
        template,
        { extensions, source, commitLink, latestCommitHash },
        { views: [join(__dirname, "templates")] }
    );

    await fs.writeFile(`${OUTPUT_DIR}/index.html`, output);
    console.log(`Build index.html with commit hash: ${latestCommitHash} (${commitLink})`);
} catch (error) {
    console.error("Error fetching commit: ", error.response?.data || error.message);
    process.exit(1);
}
