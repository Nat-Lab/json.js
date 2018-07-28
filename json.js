var json = (function () {
    /* const */
    const JSON_QUOTE = '"';
    const JSON_ESCAPE = '\\';
    
    const JSON_SPACE = ' ';
    
    const JSON_ARRL = '[';
    const JSON_ARRR = ']';
    const JSON_BL = '{';
    const JSON_BR = '}';
    const JSON_COL = ':';
    const JSON_COMA = ',';
    
    const JSON_TOKEN = [JSON_ARRL, JSON_ARRR, JSON_BL, JSON_BR, JSON_COL, JSON_COMA];
    
    /* lexer */
    var lex = (function () {
        function _match_str (expected, type, str) {
            if (str.length < expected.length) return [null, str];
            if (str.slice(0, expected.length).join('') != expected) return [null, str];

            for (var i = 0; i < expected.length; i++) str.shift();

            return [[expected, type], str];
        }
        
        function _any(fns, str) {
            for(var i = 0; i < fns.length; i++) {
                var [result, str] = fns[i](str);
                if (result) return [result, str];
            }
            return [null, str];
        }
        
        function lex_str (str) {
            var this_str = '', chr = '';
        
            if (str[0] != JSON_QUOTE) return [null, str];
            str.shift();
        
            while (chr = str.shift()) {
                if (chr == JSON_QUOTE) return [[this_str, "str"], str];
                if (chr == JSON_ESCAPE) {
                    if (!(chr = str.shift())) throw "lex_str: escaped char excepted but get end of file.";
                }
                this_str += chr;
            }
        
            throw "lex_str: quote excepted but get end of file.";
        }
        
        function lex_num (str) {
            var this_int = '', chr = '';
            var is_float = false, num_exp = false, is_eng = false;
            var r = /^[0-9]$/;
        
            if (str[0] == '-') this_int += str.shift();
        
            if (!r.test(str[0])) return [null, str]
            this_int += str.shift();
        
            while (chr = str.shift()) {
                if (chr == '.' && is_float) throw "lex_num: expect [0-9] but see '.'";
                if (chr == '.' && !is_float) {
                    is_float = true;
                    this_int += chr;
                    continue;
                }
                if (chr == 'e' && is_eng) throw "lex_num: expect [0-9] but see 'e'";
                if (chr == 'e' && !is_eng) {
                    is_eng = true;
                    this_int += chr;
                    if (!str[0]) throw "lex_num: expect [0-9] or '-' but see end of file.";
                    if (str[0] == '-') {
                        this_int += str.shift();
                        num_exp = true;
                    }
                    continue;
                }
                if (!r.test(chr)) {
                    str.unshift(chr);
                    if (num_exp) throw `lex_num: expect [0-9] but see '${chr}'.`;
                    return [[this_int, is_eng ? "eng" : is_float ? "float" : "int"], str];
                }
                num_exp = false;
                this_int += chr;
            }
        
            return [[this_int, is_eng ? "eng" : is_float ? "float" : "int"], str];
        }
        
        function lex_bool (str) {
            return _any([
                (str) => _match_str("true", "bool", str),
                (str) => _match_str("false", "bool", str)
            ], str);
        }
        
        function lex_null (str) {
            return _match_str("null", "token", str);
        }
        
        function lex_token (str) {
            if (JSON_TOKEN.includes(str[0])) return [[str.shift(), "token"], str];
            return [null, str];
        }
        
        return function lex (str) {
			var tokens = [], result = [];
            str = [...str];
        
            while (str.length > 0) {
                [result, str] = _any([
                    lex_bool, lex_null, lex_num, lex_str, lex_token
                ], str);
                if (result) tokens.push(result);
                if (!result) throw `lex: unexpected token: ${str.join(' ')}.`;
        
                if (str[0] == JSON_SPACE) str.shift();
            }
        
            return tokens;
        }
    })();
    
    /* parser */
    var parse = (function () {
        function par_array (tokens) {
            var arr = [];
            var elem_exp = false;
        
            while (tokens.length > 0) {
                var [[elem, type], tokens] = par(tokens);
                if (type == 'token') {
                  if (elem == JSON_ARRR)
                      if (!elem_exp) return [[arr, "array"], tokens];
                      else throw "par_array: expect ']' but see ','";
                  else throw `par_array: expect element but saw token '${elem}'`;
                }
                arr.push(elem);
                elem_exp = false;
        
                if (tokens.length < 1) throw "par_array: expect ',' or ']' but see end of file.";
        
                [elem, type] = tokens.shift();
                if (type == 'token') {
                    if (elem == JSON_ARRR) return [[arr, "array"], tokens];
                    else if (elem == JSON_COMA) elem_exp = true; // bad
                    else throw `par_array: expect ',' or ']' but see ${elem}.`;
                } else throw `par_array: expect ',' or ']' but see ${elem}.`;
            }
        
            throw "par_array: expect element or ']' but see end of file.";
        }
    
        function par_obj (tokens) {
            var obj = {};
			var obj_exp = false;
			var elem = '';
        
            while (tokens.length > 0) {
                var [[key, type], tokens] = par (tokens);
                if (type == 'token')
                    if (key == JSON_BR) {
                        if (obj_exp) throw "par_obj: expect key but see end of file.";
                        return [[obj, "object"], tokens];
                    }
                    else throw `par_obj: expect key or '}' but see '${key}'`;
        
               if (tokens.length < 2) throw "par_obj: expect ':' but see end of file.";
        
               var [[tkn, type], tokens] = par (tokens);
               if (type == 'token' && tkn == JSON_COL) {
                   var [[value, type], tokens] = par (tokens);
                   if (type != "token") {
                       obj[key] = value;
                       obj_exp = false;
                    }
                   else throw `par_obj: expect value but see '${value}'`;
               } else throw `par_obj: expect ':' but see '${tkn}'`;
        
               if (tokens.length < 1) throw "par_obj: expect ',' or '}' but see end of file.";
        
               [elem, type] = tokens.shift();
               if (type == 'token') {
                    if (elem == JSON_BR) return [[obj, "object"], tokens];
                    else if (elem == JSON_COMA) obj_exp = true; // bad
                    else throw `par_obj: expect ',' or '}' but see ${elem}.`;
                } else throw `par_obj: expect ',' or '}' but see ${elem}.`;
            }
        }
        
        function par (tokens) {
            if (!tokens || tokens.length < 1) throw "par: unexpected end of file.";

            var [tkn, type] = tokens.shift();
        
            switch (type) {
                case "token":
                    switch (tkn) {
                        case JSON_ARRL: return par_array(tokens);
                        case JSON_BL: return par_obj(tokens);
                        case "null": return [[null, type], tokens];
                        default: return [[tkn, type], tokens];
                    }
                case "int": return [[Number.parseInt(tkn), type], tokens];
                case "float": return [[Number.parseFloat(tkn), type], tokens];
                case "bool":
                    if (tkn == "true") return [[true, "bool"], tokens];
                    return [[false, "bool"], tokens];
                case "eng": 
                    var [n, _exp] = tkn.split('e').map(n => Number.parseFloat(n));
                    return [[n * 10**_exp, "float"], tokens];
                default: return [[tkn, type], tokens];
            }

        }
        
        return function parse (str) {
            var [parsed, unparsed] = par(lex(str));
            return {parsed, unparsed};
        }
    })();
    
    return {parse, lex};
})();
