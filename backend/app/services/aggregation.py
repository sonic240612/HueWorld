from typing import Any


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        return (0, 0, 0)
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
    )


def rgb_to_hex(r: int, g: int, b: int) -> str:
    clamp = lambda n: max(0, min(255, round(n)))
    return f"#{clamp(r):02x}{clamp(g):02x}{clamp(b):02x}".upper()


def average_color(colors: list[str]) -> str:
    if not colors:
        return "#888888"
    total_r = total_g = total_b = 0
    for c in colors:
        r, g, b = hex_to_rgb(c)
        total_r += r
        total_g += g
        total_b += b
    n = len(colors)
    return rgb_to_hex(total_r / n, total_g / n, total_b / n)


def get_dominant_from_rows(rows: list[dict[str, Any]]) -> str:
    colors = [row["color"] for row in rows if row.get("color")]
    return average_color(colors)


def get_color_distribution(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    color_map: dict[str, int] = {}
    for row in rows:
        c = row.get("color", "#888888")
        color_map[c] = color_map.get(c, 0) + 1

    sorted_colors = sorted(color_map.items(), key=lambda x: -x[1])
    return [
        {"color": color, "count": count}
        for color, count in sorted_colors[:10]
    ]
