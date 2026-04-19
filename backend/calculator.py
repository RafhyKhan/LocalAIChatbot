"""
Calculator tool — accurate math via SymPy.

Why SymPy instead of eval()?
  - eval() gets the same wrong answers as the AI (floating point, no exact fractions).
  - SymPy does symbolic math: exact fractions, surds, limits, derivatives, integrals.
  - Results like sqrt(2) stay as √2 until explicitly asked for a decimal.
  - Safe: expressions are parsed, not exec'd.

Gemma calls calculate(expression) via tool calling whenever it needs to compute
something numerical — instead of attempting the arithmetic itself and getting it wrong.
"""

import sympy
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
    convert_xor,
)

# Allow "2x" as "2*x" and "^" as "**" so Gemma can write natural math notation
_TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)

# Safe set of names SymPy expressions can reference —
# covers all common math functions without exposing Python builtins
_SYMPY_NAMESPACE = {k: v for k, v in sympy.__dict__.items() if not k.startswith("_")}

# Tool definition sent to Gemma alongside every request.
# The description tells Gemma exactly when to use it.
CALCULATOR_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": (
                "Evaluate a mathematical expression accurately using a symbolic math engine. "
                "ALWAYS use this tool instead of computing math yourself — you make arithmetic errors. "
                "Use for: arithmetic, fractions, powers, roots, trigonometry (sin/cos/tan), "
                "logarithms (log/ln), factorials, algebra, derivatives, integrals, and statistics. "
                "Supports: +, -, *, /, ** (power), sqrt(), abs(), floor(), ceiling(), "
                "sin(), cos(), tan(), asin(), acos(), atan(), log(), ln(), exp(), "
                "factorial(), gcd(), lcm(), pi, E (Euler's number), oo (infinity)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": (
                            "The mathematical expression to evaluate. "
                            "Use ** for powers (not ^). Examples: "
                            "'sqrt(144)', '(3/4)**2', 'sin(pi/6)', "
                            "'factorial(10)', 'log(1000, 10)', 'integrate(x**2, x)'."
                        ),
                    }
                },
                "required": ["expression"],
            },
        },
    }
]


def calculate(expression: str) -> str:
    """
    Evaluate a mathematical expression using SymPy and return a formatted result.

    Returns both the exact symbolic result and a decimal approximation when
    the result is numerical. For symbolic results (e.g. unsolved integrals),
    returns just the simplified form.
    """
    try:
        # Parse the expression safely — no raw eval()
        parsed = parse_expr(
            expression,
            local_dict=_SYMPY_NAMESPACE,
            transformations=_TRANSFORMATIONS,
        )

        # Simplify the result (e.g. sin(pi) → 0, sqrt(4) → 2)
        result = sympy.simplify(parsed)

        # If purely numerical, show exact + decimal approximation
        if result.is_number:
            exact = sympy.nsimplify(result, rational=False)  # keep nice forms like pi/2
            decimal = float(result.evalf(15))

            # If exact == decimal (e.g. result is already an integer), show once
            if str(exact) == str(decimal) or exact == result:
                return f"{decimal:g}"

            return f"Exact: {exact}\nDecimal: {decimal:g}"

        # Symbolic result (expression with variables, unevaluated integrals, etc.)
        return f"Result: {result}"

    except Exception as e:
        return (
            f"Could not evaluate '{expression}': {e}\n"
            "Try rephrasing — use ** for powers, sqrt() for square roots, "
            "pi for π, E for Euler's number."
        )
