const major = Number(process.versions.node.split(".")[0]);

if (major < 18) {
  console.error(`
SentinelWatch requires Node.js 18+ (Next.js 16). You are on ${process.version}.

Fix (you already have Node 20 via n):
  export PATH="$HOME/.local/n/bin:$PATH"
  node -v
  npm run dev

To make this permanent, add to ~/.bashrc:
  export PATH="$HOME/.local/n/bin:$PATH"
`);
  process.exit(1);
}
