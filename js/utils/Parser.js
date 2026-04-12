/**
 * Parser.js - 함수 표현식 파서
 * 수학 함수 문자열을 JavaScript 함수로 변환
 */

import { MathUtils } from './MathUtils.js';

/**
 * 토큰 타입
 */
const TokenType = {
    NUMBER: 'NUMBER',
    VARIABLE: 'VARIABLE',
    OPERATOR: 'OPERATOR',
    FUNCTION: 'FUNCTION',
    LPAREN: 'LPAREN',
    RPAREN: 'RPAREN',
    COMMA: 'COMMA',
    EOF: 'EOF'
};

/**
 * 지원하는 함수들
 */
const FUNCTIONS = {
    'sin': Math.sin,
    'cos': Math.cos,
    'tan': Math.tan,
    'asin': Math.asin,
    'acos': Math.acos,
    'atan': Math.atan,
    'sinh': Math.sinh,
    'cosh': Math.cosh,
    'tanh': Math.tanh,
    'sqrt': Math.sqrt,
    'abs': Math.abs,
    'floor': Math.floor,
    'ceil': Math.ceil,
    'round': Math.round,
    'log': Math.log10,
    'ln': Math.log,
    'log10': Math.log10,
    'log2': Math.log2,
    'exp': Math.exp,
    'sign': Math.sign,
    'min': Math.min,
    'max': Math.max,
    'pow': Math.pow
};

/**
 * 상수들
 */
const CONSTANTS = {
    'pi': Math.PI,
    'PI': Math.PI,
    'π': Math.PI,
    'e': Math.E,
    'E': Math.E
};

/**
 * 연산자 우선순위
 */
const PRECEDENCE = {
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 2,
    '%': 2,
    '^': 3
};

/**
 * 렉서 - 문자열을 토큰으로 분해
 */
class Lexer {
    constructor(expression) {
        this.expression = expression.replace(/\s+/g, '');
        this.pos = 0;
    }

    peek() {
        return this.expression[this.pos] || '';
    }

    advance() {
        return this.expression[this.pos++] || '';
    }

    isDigit(ch) {
        return /[0-9.]/.test(ch);
    }

    isLetter(ch) {
        return /[a-zA-Zπ]/.test(ch);
    }

    isOperator(ch) {
        return '+-*/%^'.includes(ch);
    }

    readNumber() {
        let num = '';
        while (this.isDigit(this.peek())) {
            num += this.advance();
        }
        return parseFloat(num);
    }

    readIdentifier() {
        let id = '';
        while (this.isLetter(this.peek()) || this.isDigit(this.peek())) {
            id += this.advance();
        }
        return id;
    }

    nextToken() {
        if (this.pos >= this.expression.length) {
            return { type: TokenType.EOF };
        }

        const ch = this.peek();

        // 숫자
        if (this.isDigit(ch)) {
            return { type: TokenType.NUMBER, value: this.readNumber() };
        }

        // 식별자 (변수, 함수, 상수)
        if (this.isLetter(ch)) {
            const id = this.readIdentifier();

            if (id in CONSTANTS) {
                return { type: TokenType.NUMBER, value: CONSTANTS[id] };
            }
            if (id in FUNCTIONS) {
                return { type: TokenType.FUNCTION, value: id };
            }
            return { type: TokenType.VARIABLE, value: id };
        }

        // 연산자
        if (this.isOperator(ch)) {
            this.advance();
            return { type: TokenType.OPERATOR, value: ch };
        }

        // 괄호
        if (ch === '(') {
            this.advance();
            return { type: TokenType.LPAREN };
        }
        if (ch === ')') {
            this.advance();
            return { type: TokenType.RPAREN };
        }

        // 쉼표
        if (ch === ',') {
            this.advance();
            return { type: TokenType.COMMA };
        }

        throw new Error(`알 수 없는 문자: ${ch}`);
    }

    tokenize() {
        const tokens = [];
        let token;

        while ((token = this.nextToken()).type !== TokenType.EOF) {
            tokens.push(token);
        }

        return tokens;
    }
}

/**
 * 파서 - 토큰을 AST로 변환
 */
class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }

    peek() {
        return this.tokens[this.pos] || { type: TokenType.EOF };
    }

    advance() {
        return this.tokens[this.pos++] || { type: TokenType.EOF };
    }

    expect(type) {
        const token = this.advance();
        if (token.type !== type) {
            throw new Error(`예상: ${type}, 실제: ${token.type}`);
        }
        return token;
    }

    parse() {
        const result = this.parseExpression();
        if (this.peek().type !== TokenType.EOF) {
            throw new Error('표현식 파싱 후 남은 토큰이 있습니다');
        }
        return result;
    }

    parseExpression(minPrecedence = 0) {
        let left = this.parsePrimary();

        while (true) {
            const op = this.peek();
            if (op.type !== TokenType.OPERATOR) break;

            const prec = PRECEDENCE[op.value];
            if (prec < minPrecedence) break;

            this.advance();

            // 오른쪽 결합 (^)
            const nextMinPrec = op.value === '^' ? prec : prec + 1;
            const right = this.parseExpression(nextMinPrec);

            left = {
                type: 'BinaryOp',
                op: op.value,
                left,
                right
            };
        }

        return left;
    }

    parsePrimary() {
        const token = this.peek();

        // 단항 연산자
        if (token.type === TokenType.OPERATOR && (token.value === '-' || token.value === '+')) {
            this.advance();
            const operand = this.parsePrimary();
            return {
                type: 'UnaryOp',
                op: token.value,
                operand
            };
        }

        // 숫자
        if (token.type === TokenType.NUMBER) {
            this.advance();
            return { type: 'Number', value: token.value };
        }

        // 변수
        if (token.type === TokenType.VARIABLE) {
            this.advance();
            return { type: 'Variable', name: token.value };
        }

        // 함수
        if (token.type === TokenType.FUNCTION) {
            this.advance();
            this.expect(TokenType.LPAREN);

            const args = [];
            if (this.peek().type !== TokenType.RPAREN) {
                args.push(this.parseExpression());
                while (this.peek().type === TokenType.COMMA) {
                    this.advance();
                    args.push(this.parseExpression());
                }
            }

            this.expect(TokenType.RPAREN);
            return { type: 'FunctionCall', name: token.value, args };
        }

        // 괄호
        if (token.type === TokenType.LPAREN) {
            this.advance();
            const expr = this.parseExpression();
            this.expect(TokenType.RPAREN);
            return expr;
        }

        throw new Error(`예상치 못한 토큰: ${JSON.stringify(token)}`);
    }
}

/**
 * AST를 함수로 컴파일
 */
function compile(ast) {
    switch (ast.type) {
        case 'Number':
            return () => ast.value;

        case 'Variable':
            return (vars) => {
                if (!(ast.name in vars)) {
                    throw new Error(`정의되지 않은 변수: ${ast.name}`);
                }
                return vars[ast.name];
            };

        case 'UnaryOp':
            const operand = compile(ast.operand);
            if (ast.op === '-') {
                return (vars) => -operand(vars);
            }
            return operand;

        case 'BinaryOp':
            const left = compile(ast.left);
            const right = compile(ast.right);

            switch (ast.op) {
                case '+': return (vars) => left(vars) + right(vars);
                case '-': return (vars) => left(vars) - right(vars);
                case '*': return (vars) => left(vars) * right(vars);
                case '/': return (vars) => left(vars) / right(vars);
                case '%': return (vars) => left(vars) % right(vars);
                case '^': return (vars) => Math.pow(left(vars), right(vars));
                default: throw new Error(`알 수 없는 연산자: ${ast.op}`);
            }

        case 'FunctionCall':
            const fn = FUNCTIONS[ast.name];
            if (!fn) throw new Error(`알 수 없는 함수: ${ast.name}`);

            const args = ast.args.map(compile);
            return (vars) => fn(...args.map(a => a(vars)));

        default:
            throw new Error(`알 수 없는 AST 노드: ${ast.type}`);
    }
}

/**
 * 함수 표현식 파서
 */
export class FunctionParser {
    /**
     * 표현식을 파싱하여 함수 반환
     * @param {string} expression - 수학 표현식 (예: "x^2 - 2*x + 1")
     * @returns {Function} (x) => number
     */
    static parse(expression) {
        try {
            // 암시적 곱셈 처리 (2x -> 2*x, x(x+1) -> x*(x+1), 2sin(x) -> 2*sin(x))
            expression = expression
                .replace(/(\d)([a-zA-Z])/g, '$1*$2')
                .replace(/(\))(\d)/g, '$1*$2')
                .replace(/(\d)(\()/g, '$1*$2')
                .replace(/(\))(\()/g, '$1*$2')
                .replace(/(\))([a-zA-Z])/g, '$1*$2')
                .replace(/([a-zA-Z])(\()/g, (match, p1, p2) => {
                    // 함수 호출은 제외
                    if (p1 in FUNCTIONS || p1 === 'x' || p1 === 'y') {
                        if (p1 in FUNCTIONS) return match;
                        return p1 + '*' + p2;
                    }
                    return match;
                });

            const lexer = new Lexer(expression);
            const tokens = lexer.tokenize();

            // 암시적 곱셈 토큰 처리
            const processedTokens = [];
            for (let i = 0; i < tokens.length; i++) {
                const curr = tokens[i];
                const prev = processedTokens[processedTokens.length - 1];

                // 이전 토큰이 숫자/변수/닫는괄호이고 현재가 숫자/변수/함수/여는괄호면 곱셈 삽입
                if (prev &&
                    (prev.type === TokenType.NUMBER ||
                        prev.type === TokenType.VARIABLE ||
                        prev.type === TokenType.RPAREN) &&
                    (curr.type === TokenType.NUMBER ||
                        curr.type === TokenType.VARIABLE ||
                        curr.type === TokenType.FUNCTION ||
                        curr.type === TokenType.LPAREN)) {
                    processedTokens.push({ type: TokenType.OPERATOR, value: '*' });
                }

                processedTokens.push(curr);
            }

            const parser = new Parser(processedTokens);
            const ast = parser.parse();
            const fn = compile(ast);

            return (x) => {
                try {
                    const result = fn({ x });
                    if (!isFinite(result)) return NaN;
                    return result;
                } catch {
                    return NaN;
                }
            };
        } catch (error) {
            console.error('함수 파싱 오류:', error);
            throw error;
        }
    }

    /**
     * 표현식 유효성 검사
     */
    static validate(expression) {
        try {
            this.parse(expression);
            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * 수치 미분 (중앙 차분)
     */
    static derivative(fn, h = 1e-7) {
        return (x) => {
            const y1 = fn(x - h);
            const y2 = fn(x + h);
            if (isNaN(y1) || isNaN(y2)) return NaN;
            return (y2 - y1) / (2 * h);
        };
    }

    /**
     * 접선의 기울기와 y절편
     */
    static tangentAt(fn, x0) {
        const y0 = fn(x0);
        const df = this.derivative(fn);
        const slope = df(x0);

        if (isNaN(y0) || isNaN(slope) || !isFinite(slope)) {
            return null;
        }

        return {
            slope,
            yIntercept: y0 - slope * x0,
            point: { x: x0, y: y0 }
        };
    }
}

export default FunctionParser;
