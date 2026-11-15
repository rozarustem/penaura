import argparse
from html.parser import HTMLParser
from pathlib import Path


class InlineStyleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.blocks = []
        self.current_block = None

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "style":
            self.current_block = []

    def handle_data(self, data):
        if self.current_block is not None:
            self.current_block.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "style" and self.current_block is not None:
            block = "".join(self.current_block).strip()
            if block:
                self.blocks.append(block)
            self.current_block = None


def collect_inline_styles(root):
    extracted = []
    for html_file in sorted(root.glob("*.html")):
        parser = InlineStyleParser()
        parser.feed(html_file.read_text(encoding="utf-8"))
        for index, block in enumerate(parser.blocks, start=1):
            extracted.append(f"/* {html_file.name} style #{index} */\n{block}")
    return extracted


def main():
    argument_parser = argparse.ArgumentParser(
        description="Find inline style blocks and optionally save them separately."
    )
    argument_parser.add_argument(
        "--write",
        action="store_true",
        help="Write extracted styles to css/extracted-inline.css.",
    )
    args = argument_parser.parse_args()

    root = Path(__file__).resolve().parent
    styles = collect_inline_styles(root)
    if not styles:
        print("No inline <style> blocks found; no files changed.")
        return

    output_path = root / "css" / "extracted-inline.css"
    if not args.write:
        print(f"Found {len(styles)} inline style blocks; no files changed.")
        print(f"Run with --write to save them to {output_path}.")
        return

    output_path.parent.mkdir(exist_ok=True)
    output_path.write_text("\n\n".join(styles) + "\n", encoding="utf-8")
    print(f"Wrote {len(styles)} inline style blocks to {output_path}.")


if __name__ == "__main__":
    main()
