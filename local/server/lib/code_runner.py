"""Laboratorio local: datos desechables, Python limitado y SQLite en memoria.

No es un servicio para ejecutar código de usuarios remotos. Cada ejecución
vive en un proceso nuevo, sin acceso al disco ni imports arbitrarios.
"""
import ast
import builtins
import contextlib
import io
import json
import math
import operator
import sqlite3
import sys
import time
import types

sys.setrecursionlimit(256)
DEADLINE = time.monotonic() + 1.8
MAX_SIZE = 10000


def bounded(value):
    if isinstance(value, (str, list, tuple, dict, set)) and len(value) > MAX_SIZE:
        raise ValueError("Resultado demasiado grande (máximo 10000 elementos).")
    if isinstance(value, int) and value.bit_length() > 4096:
        raise ValueError("Número demasiado grande para este laboratorio.")
    return value


def binary(a, b, op):
    if op == "Mult":
        for seq, count in ((a, b), (b, a)):
            if isinstance(seq, (str, list, tuple)) and isinstance(count, int):
                if len(seq) * max(count, 0) > MAX_SIZE:
                    raise ValueError("Repetición demasiado grande.")
        if isinstance(a, int) and isinstance(b, int) and a.bit_length() + b.bit_length() > 4096:
            raise ValueError("Número demasiado grande.")
    if op == "Pow" and (abs(b) > 100 or abs(a) > 1000000):
        raise ValueError("Potencia demasiado grande.")
    if op in ("LShift", "RShift") and (b < 0 or b > 100):
        raise ValueError("Desplazamiento demasiado grande.")
    operations = {"Add": operator.add, "Sub": operator.sub, "Mult": operator.mul,
                  "Div": operator.truediv, "FloorDiv": operator.floordiv,
                  "Mod": operator.mod, "Pow": operator.pow, "BitOr": operator.or_,
                  "BitAnd": operator.and_, "BitXor": operator.xor,
                  "LShift": operator.lshift, "RShift": operator.rshift}
    return bounded(operations[op](a, b))


class Arithmetic(ast.NodeTransformer):
    def visit_BinOp(self, node):
        self.generic_visit(node)
        return ast.copy_location(ast.Call(ast.Name("_binary", ast.Load()),
                                         [node.left, node.right, ast.Constant(type(node.op).__name__)], []), node)


def limited_range(*args):
    result = range(*args)
    if len(result) > MAX_SIZE:
        raise ValueError("range está limitado a 10000 elementos.")
    return result


def split_sql(code):
    statements, buffer = [], ""
    for char in code:
        buffer += char
        if char == ";" and sqlite3.complete_statement(buffer):
            statements.append(buffer)
            buffer = ""
    if buffer.strip():
        statements.append(buffer)
    return statements


def connection(setup=""):
    db = sqlite3.connect(":memory:")
    db.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 1000000)
    db.setlimit(sqlite3.SQLITE_LIMIT_SQL_LENGTH, 16000)
    db.setlimit(sqlite3.SQLITE_LIMIT_ATTACHED, 0)
    db.setlimit(sqlite3.SQLITE_LIMIT_COLUMN, 100)
    db.executescript(setup)
    def authorize(action, arg1, arg2, database, source):
        forbidden = (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH,
                     sqlite3.SQLITE_PRAGMA, sqlite3.SQLITE_CREATE_VTABLE)
        if action in forbidden or (action == sqlite3.SQLITE_FUNCTION and
                                  str(arg2).lower() in ("load_extension", "readfile", "writefile")):
            return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK
    db.set_authorizer(authorize)
    db.set_progress_handler(lambda: int(time.monotonic() > DEADLINE), 1000)
    return db


def run_sql(code, setup):
    with contextlib.closing(connection(setup)) as db:
        result = {"columns": [], "rows": []}
        statements = split_sql(code)
        if len(statements) > 30:
            raise ValueError("Máximo 30 sentencias por ejecución.")
        for statement in statements:
            cursor = db.execute(statement)
            if cursor.description:
                rows = cursor.fetchmany(101)
                if len(rows) > 100:
                    raise ValueError("Máximo 100 filas: utiliza LIMIT.")
                result = {"columns": [item[0] for item in cursor.description], "rows": rows}
        if not result["columns"]:
            raise ValueError("Termina con un SELECT para mostrar el resultado.")
        return result


ATTRIBUTES = set("append extend pop remove insert sort reverse clear copy count index "
                 "upper lower strip lstrip rstrip split join replace startswith endswith "
                 "isdigit isalpha capitalize title find keys values items get "
                 "update setdefault add discard union intersection difference "
                 "read readline readlines write seek close execute executemany fetchone "
                 "fetchall fetchmany cursor commit rollback connect dumps loads "
                 "sqrt ceil floor isclose pi e name price balance total deposit label".split())


def python_code(code):
    tree = ast.parse(code, filename="tu_codigo.py", mode="exec")
    if len(list(ast.walk(tree))) > 2000:
        raise ValueError("Programa demasiado largo.")
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and node.attr not in ATTRIBUTES:
            raise ValueError(f"El atributo {node.attr!r} no está habilitado en el laboratorio.")
        if isinstance(node, ast.Name) and node.id.startswith("_"):
            raise ValueError("Los nombres internos no están permitidos.")
        if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name.startswith("_"):
            raise ValueError("Los nombres internos no están permitidos.")
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = [item.name for item in node.names] if isinstance(node, ast.Import) else [node.module]
            if getattr(node, "level", 0) or any(name not in ("math", "json", "sqlite3") for name in names):
                raise ValueError("Solo puedes importar math, json y sqlite3 en este laboratorio.")
            if isinstance(node, ast.ImportFrom) and any(item.name.startswith("_") or item.name == "*" for item in node.names):
                raise ValueError("Importación no permitida.")
        if isinstance(node, (ast.AsyncFunctionDef, ast.Await, ast.Global, ast.Nonlocal)):
            raise ValueError("Esta construcción no está disponible en el laboratorio.")
    return compile(ast.fix_missing_locations(Arithmetic().visit(tree)), "tu_codigo.py", "exec")


class Output(io.StringIO):
    def write(self, value):
        if self.tell() + len(value) > MAX_SIZE:
            raise ValueError("Salida demasiado larga.")
        return super().write(value)


def run_python(compiled, case):
    files = dict(case.get("files", {}))
    def virtual_open(name, mode="r", encoding=None):
        if mode not in ("r", "rt") or name not in files:
            raise ValueError("Solo puedes leer los archivos de ejemplo del ejercicio.")
        return io.StringIO(files[name])
    def safe_connect(name):
        if name != ":memory:":
            raise ValueError("Utiliza sqlite3.connect(':memory:').")
        return connection()
    modules = {"math": types.SimpleNamespace(sqrt=math.sqrt, ceil=math.ceil, floor=math.floor,
                                            isclose=math.isclose, pi=math.pi, e=math.e),
               "json": types.SimpleNamespace(loads=json.loads, dumps=json.dumps),
               "sqlite3": types.SimpleNamespace(connect=safe_connect)}
    def safe_import(name, *args, **kwargs):
        if name not in modules:
            raise ValueError("Importación no permitida.")
        return modules[name]
    names = "abs all any bool dict enumerate filter float int isinstance len list map max min next print range reversed round set sorted str sum tuple zip Exception ValueError TypeError ZeroDivisionError KeyError IndexError StopIteration".split()
    allowed = {name: getattr(builtins, name) for name in names}
    allowed.update({"__import__": safe_import, "__build_class__": builtins.__build_class__,
                    "open": virtual_open, "range": limited_range})
    scope = {"__builtins__": allowed, "__name__": "laboratorio", "_binary": binary}
    scope.update(case.get("globals", {}))
    output, ticks = Output(), [0]
    def trace(frame, event, arg):
        ticks[0] += 1
        if ticks[0] > 60000 or time.monotonic() > DEADLINE:
            raise TimeoutError("Tu programa tarda demasiado. Revisa los bucles.")
        return trace
    try:
        sys.settrace(trace)
        with contextlib.redirect_stdout(output):
            exec(compiled, scope)
        value = scope.get("resultado")
        if "resultado" not in scope:
            raise ValueError("Guarda la respuesta en la variable resultado.")
        return {"value": bounded(value), "stdout": output.getvalue()}
    finally:
        sys.settrace(None)


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False)


def main():
    request = json.load(sys.stdin)
    language, payload = request["language"], request["payload"]
    code, reference = request["code"], request["reference"]
    if language == "python":
        compiled, model = python_code(code), python_code(reference)
    checks, last = [], None
    for case in payload["cases"]:
        try:
            if language == "sql":
                expected = run_sql(reference, case["setup"])
                actual = run_sql(code, case["setup"])
                left, right = actual["rows"], expected["rows"]
                if not payload.get("ordered", False):
                    left = sorted(left, key=canonical)
                    right = sorted(right, key=canonical)
                passed = actual["columns"] == expected["columns"] and canonical(left) == canonical(right)
            else:
                expected = run_python(model, case)
                actual = run_python(compiled, case)
                passed = canonical(actual["value"]) == canonical(expected["value"])
            last = actual
            checks.append({"name": case["name"], "passed": passed, "expected": expected, "actual": actual})
        except Exception as error:
            checks.append({"name": case["name"], "passed": False,
                           "error": f"{type(error).__name__}: {error}"})
    return {"correct": all(item["passed"] for item in checks), "checks": checks, "output": last}


try:
    result = main()
except Exception as error:
    result = {"correct": False, "checks": [], "error": f"{type(error).__name__}: {error}"}
print(json.dumps(result, ensure_ascii=False))
