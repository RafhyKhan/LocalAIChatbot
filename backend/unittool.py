"""
Unit conversion tool — accurate conversions via a Python lookup table.

Why not let Gemma convert units itself?
  - Gemma frequently makes small errors on conversions (wrong multiplier, rounding).
  - This table is exact for common everyday units.
  - No extra library needed — pure Python math.

Supported categories:
  Length      : m, km, mi, ft, in, cm, mm, yd
  Weight/Mass : kg, g, lb, oz, mg, t (metric ton)
  Temperature : C, F, K  (non-linear — handled separately)
  Volume      : L, mL, gal, fl_oz, cup, pt, qt
  Speed       : km/h, mph, m/s, knot
  Area        : m2, km2, mi2, ft2, acre, ha
"""

# ── Conversion tables ─────────────────────────────────────────────
# All values are multipliers TO the base unit for each category.
# Base units: m (length), kg (weight), L (volume), m/s (speed), m2 (area)

_LENGTH = {
    "m": 1, "meter": 1, "meters": 1,
    "km": 1000, "kilometer": 1000, "kilometers": 1000,
    "mi": 1609.344, "mile": 1609.344, "miles": 1609.344,
    "ft": 0.3048, "foot": 0.3048, "feet": 0.3048,
    "in": 0.0254, "inch": 0.0254, "inches": 0.0254,
    "cm": 0.01, "centimeter": 0.01, "centimeters": 0.01,
    "mm": 0.001, "millimeter": 0.001, "millimeters": 0.001,
    "yd": 0.9144, "yard": 0.9144, "yards": 0.9144,
}

_WEIGHT = {
    "kg": 1, "kilogram": 1, "kilograms": 1,
    "g": 0.001, "gram": 0.001, "grams": 0.001,
    "mg": 1e-6, "milligram": 1e-6, "milligrams": 1e-6,
    "lb": 0.453592, "pound": 0.453592, "pounds": 0.453592, "lbs": 0.453592,
    "oz": 0.0283495, "ounce": 0.0283495, "ounces": 0.0283495,
    "t": 1000, "tonne": 1000, "metric ton": 1000,
}

_VOLUME = {
    "l": 1, "liter": 1, "liters": 1, "litre": 1, "litres": 1,
    "ml": 0.001, "milliliter": 0.001, "milliliters": 0.001,
    "gal": 3.78541, "gallon": 3.78541, "gallons": 3.78541,
    "fl_oz": 0.0295735, "fl oz": 0.0295735, "fluid ounce": 0.0295735,
    "cup": 0.236588, "cups": 0.236588,
    "pt": 0.473176, "pint": 0.473176, "pints": 0.473176,
    "qt": 0.946353, "quart": 0.946353, "quarts": 0.946353,
}

_SPEED = {
    "m/s": 1, "mps": 1,
    "km/h": 1 / 3.6, "kph": 1 / 3.6, "kmh": 1 / 3.6,
    "mph": 0.44704, "mi/h": 0.44704,
    "knot": 0.514444, "knots": 0.514444, "kn": 0.514444,
}

_AREA = {
    "m2": 1, "m²": 1, "sqm": 1, "square meter": 1,
    "km2": 1e6, "km²": 1e6, "square kilometer": 1e6,
    "mi2": 2589988.11, "mi²": 2589988.11, "square mile": 2589988.11,
    "ft2": 0.092903, "ft²": 0.092903, "square foot": 0.092903, "square feet": 0.092903,
    "acre": 4046.86, "acres": 4046.86,
    "ha": 10000, "hectare": 10000, "hectares": 10000,
}

# All categories in order of lookup
_CATEGORIES = [_LENGTH, _WEIGHT, _VOLUME, _SPEED, _AREA]
_CATEGORY_NAMES = ["length", "weight/mass", "volume", "speed", "area"]

# Tool definition sent to Gemma alongside every request.
UNITTOOL_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "convert_units",
            "description": (
                "Convert a value from one unit to another accurately. "
                "ALWAYS use this tool instead of estimating conversions yourself — you make conversion errors. "
                "Supports: "
                "Length (m, km, mi, ft, in, cm, mm, yd), "
                "Weight (kg, g, lb, oz, mg, t), "
                "Temperature (C, F, K), "
                "Volume (L, mL, gal, fl_oz, cup, pt, qt), "
                "Speed (km/h, mph, m/s, knot), "
                "Area (m2, km2, mi2, ft2, acre, ha)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "value": {
                        "type": "number",
                        "description": "The numeric value to convert. Example: 100",
                    },
                    "from_unit": {
                        "type": "string",
                        "description": "The unit to convert from. Example: 'miles', 'kg', 'F'",
                    },
                    "to_unit": {
                        "type": "string",
                        "description": "The unit to convert to. Example: 'km', 'lb', 'C'",
                    },
                },
                "required": ["value", "from_unit", "to_unit"],
            },
        },
    }
]


def _temp_convert(value: float, from_unit: str, to_unit: str) -> str:
    """Handle temperature conversions (non-linear — can't use a simple multiplier)."""
    f = from_unit.upper().replace("°", "").strip()
    t = to_unit.upper().replace("°", "").strip()

    # Convert to Celsius first
    if f == "C":
        celsius = value
    elif f == "F":
        celsius = (value - 32) * 5 / 9
    elif f == "K":
        celsius = value - 273.15
    else:
        return None  # not a temperature unit

    # Convert from Celsius to target
    if t == "C":
        result = celsius
    elif t == "F":
        result = celsius * 9 / 5 + 32
    elif t == "K":
        result = celsius + 273.15
    else:
        return None  # target is not a temperature unit

    return f"{value} {from_unit} = {result:.4g} {to_unit}"


def convert_units(value: float, from_unit: str, to_unit: str) -> str:
    """
    Convert value from from_unit to to_unit.
    Returns a formatted result string or an error message.
    """
    try:
        value = float(value)
    except (TypeError, ValueError):
        return f"Invalid value: '{value}'. Must be a number."

    from_key = from_unit.lower().strip()
    to_key   = to_unit.lower().strip()

    # Try temperature first (special case)
    temp_result = _temp_convert(value, from_unit, to_unit)
    if temp_result is not None:
        return temp_result

    # Search all categories for matching units
    for category, name in zip(_CATEGORIES, _CATEGORY_NAMES):
        if from_key in category and to_key in category:
            # Convert: value → base unit → target unit
            base   = value * category[from_key]
            result = base / category[to_key]
            # Format: avoid ugly floats for clean numbers
            result_str = f"{result:,.6g}"
            return f"{value:g} {from_unit} = {result_str} {to_unit}  ({name})"

    # Units found but in different categories
    for category in _CATEGORIES:
        if from_key in category:
            return (
                f"Cannot convert '{from_unit}' to '{to_unit}' — they are different types of units.\n"
                f"'{from_unit}' is a {_CATEGORY_NAMES[_CATEGORIES.index(category)]} unit."
            )

    return (
        f"Unknown unit: '{from_unit}' or '{to_unit}'.\n"
        "Supported: m/km/mi/ft/in/cm/mm/yd (length), kg/g/lb/oz/mg (weight), "
        "C/F/K (temperature), L/mL/gal/fl_oz/cup (volume), km/h/mph/m/s/knot (speed), "
        "m2/km2/mi2/ft2/acre/ha (area)."
    )
