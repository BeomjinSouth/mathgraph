"""Strict LaTeX to Hancom equation script; unknown commands fail before insertion."""
import re

SYMBOLS = {
    'times': 'times', 'cdot': 'cdot', 'div': 'div', 'pm': '+-', 'mp': '-+',
    'le': 'LEQ', 'leq': 'LEQ', 'ge': 'GEQ', 'geq': 'GEQ', 'ne': 'neq', 'neq': 'neq',
    'approx': 'APPROX', 'equiv': 'EQUIV', 'sim': 'SIM', 'cong': 'CONG',
    'in': 'IN', 'notin': 'NOTIN', 'subset': 'SUBSET', 'subseteq': 'SUBSETEQ',
    'cup': 'CUP', 'cap': 'CAP', 'infty': 'inf', 'to': '->', 'rightarrow': '->',
    'leftarrow': '<-', 'Rightarrow': 'RARROW', 'Leftrightarrow': 'LRARROW',
    'angle': 'ANGLE', 'triangle': 'TRIANGLE', 'circ': 'circ', 'degree': 'DEG',
    'perp': 'BOT', 'parallel': 'PARALLEL', 'cdots': 'cdots', 'ldots': 'ldots',
    'dots': 'cdots', 'therefore': 'THEREFORE', 'because': 'BECAUSE',
    'sum': 'sum', 'prod': 'prod', 'int': 'int', 'lim': 'lim', 'log': 'log',
    'ln': 'ln', 'sin': 'sin', 'cos': 'cos', 'tan': 'tan', 'cot': 'cot',
    'sec': 'sec', 'csc': 'csc', 'max': 'max', 'min': 'min',
}
for _name in 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi pi rho sigma tau upsilon phi chi psi omega'.split():
    SYMBOLS[_name] = _name
    SYMBOLS[_name.capitalize()] = _name.capitalize()
UNICODE = dict(zip('αβγδθλμπρσφω', [' \\' + name + ' ' for name in ['alpha', 'beta', 'gamma', 'delta', 'theta', 'lambda', 'mu', 'pi', 'rho', 'sigma', 'phi', 'omega']]))
UNICODE.update({'−': '-', '×': ' times ', '÷': ' div ', '≤': ' LEQ ', '≥': ' GEQ ', '≠': ' neq ', '±': '+-', '∞': ' inf ', '∠': ' ANGLE ', '△': ' TRIANGLE ', '°': '^{circ}', '²': '^2', '³': '^3', '·': ' cdot '})


def to_hwp(source):
    if not isinstance(source, str) or not source.strip() or len(source) > 2000:
        raise ValueError('수식이 비어 있거나 너무 깁니다.')
    if re.search(r'[\x00-\x08\x0b-\x1f]', source):
        raise ValueError('수식에 사용할 수 없는 문자가 있습니다.')
    expr = ''.join(UNICODE.get(c, c) for c in source.strip())
    pos = 0

    def group():
        nonlocal pos
        while pos < len(expr) and expr[pos].isspace():
            pos += 1
        if pos >= len(expr) or expr[pos] != '{':
            raise ValueError('분수·근호·첨자의 중괄호를 확인해 주세요.')
        pos += 1
        return parse(True)

    def command():
        nonlocal pos
        match = re.match(r'[A-Za-z]+|.', expr[pos:])
        if not match:
            raise ValueError('수식의 마지막 명령을 확인해 주세요.')
        name = match[0]
        pos += len(name)
        if name in ('frac', 'dfrac', 'tfrac'):
            numerator, denominator = group(), group()
            # A LaTeX fraction is one atom. Hancom's infix over must not
            # absorb a preceding equality or the following product/sum.
            return '{{' + numerator + '} over {' + denominator + '}}'
        if name == 'sqrt':
            index = ''
            if pos < len(expr) and expr[pos] == '[':
                end = expr.find(']', pos)
                if end < 0:
                    raise ValueError('근호의 지수를 확인해 주세요.')
                index = to_hwp(expr[pos + 1:end])
                pos = end + 1
            return ('root {' + index + '} of ' if index else 'sqrt ') + '{' + group() + '}'
        if name in ('mathrm', 'text', 'operatorname', 'mathbf', 'mathit'):
            return ('bold' if name == 'mathbf' else 'it' if name == 'mathit' else 'rm') + ' {' + group() + '}'
        if name in ('overline', 'bar', 'vec', 'overrightarrow', 'hat'):
            return {'overline': 'bar', 'overrightarrow': 'vec'}.get(name, name) + ' {' + group() + '}'
        if name == 'binom':
            first, second = group(), group()
            return '{{' + first + '} choose {' + second + '}}'
        if name in ('left', 'right', '!'):
            return ''
        if name in ('{', '}'):
            return ('left' if name == '{' else 'right') + name
        if name in (',', ';', ':', ' ', 'quad', 'qquad'):
            return '~'
        if name in ('vert', 'mid'):
            return '|'
        if name in SYMBOLS:
            return ' ' + SYMBOLS[name] + ' '
        raise ValueError('아직 지원하지 않는 수식 명령입니다: \\' + name)

    def script_argument():
        nonlocal pos
        while pos < len(expr) and expr[pos].isspace():
            pos += 1
        if pos < len(expr) and expr[pos] == '{':
            value = group()
        elif pos < len(expr) and expr[pos] == '\\':
            pos += 1
            value = command().strip()
        elif pos < len(expr) and expr[pos].isalnum():
            value = expr[pos]
            pos += 1
        else:
            raise ValueError('지수·첨자가 비어 있거나 모호합니다. 음수나 여러 항은 중괄호로 묶어 주세요.')
        if not value.strip():
            raise ValueError('지수·첨자의 내용을 확인해 주세요.')
        return value

    def parse(nested=False):
        nonlocal pos
        out = []
        while pos < len(expr):
            c = expr[pos]
            pos += 1
            if c == '}':
                if not nested:
                    raise ValueError('수식의 중괄호 짝이 맞지 않습니다.')
                return ''.join(out)
            if c == '{':
                out.append('{' + parse(True) + '}')
            elif c in ('^', '_'):
                # Hancom can consume the rest of the line after an ungrouped
                # script; LaTeX only consumes one token or one braced group.
                out.append(c + '{' + script_argument() + '}')
            elif c == '\\':
                out.append(command())
            else:
                out.append(c)
        if nested:
            raise ValueError('수식의 중괄호 짝이 맞지 않습니다.')
        return ''.join(out)
    return re.sub(r'\s+', ' ', parse()).strip()
