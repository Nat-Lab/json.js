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
            var expected = [...expected];
            var this_read = '';
            var _str = str.slice(); // bad
        
            while ((chr = str.shift()) && (_chr = expected.shift()))
                if (_chr != chr) return [null, _str];
                else this_read += chr;
        
            return [[this_read, type], str];
        }
        
        function _any(fns, str) {
            for(var i = 0; i < fns.length; i++) {
                var [result, rest] = fns[i](str);
                str = rest;
                if (result) return [result, rest];
            }
            return [null, str];
        }
        
        function lex_str (str) {
            this_str = '';
        
            if (str[0] != JSON_QUOTE) return [null, str];
            str.shift()
        
            while (chr = str.shift()) {
                if (chr == JSON_QUOTE) return [[this_str, "str"], str];
                if (chr == JSON_ESCAPE) {
                    if (!(chr = str.shift())) throw "lex_str: escaped char excepted.";
                }
                this_str += chr;
            }
        
            throw "lex_str: quote excepted.";
        }
        
        function lex_num (str) {
            var this_int = '';
            var is_float = false;
            var is_eng = false;
            var r = /^[0-9]$/;
        
            if (str[0] == '-') this_int += str.shift();
        
            if (!r.test(str[0])) return [null, str]
            this_int += str.shift();
        
            while (chr = str.shift()) {
                if (chr == '.' && is_float) throw "lex_num: unexpected '.'";
                if (chr == '.' && !is_float) {
                    is_float = true;
                    this_int += chr;
                    continue;
                }
                if (chr == 'e' && is_eng) throw "lex_num: unexpected 'e'"; // TODO: eng float (e.g. 3e-5)
                if (chr == 'e' && !is_eng) {
                    is_eng = true;
                    this_int += chr;
                    continue;
                }
                if (!r.test(chr)) {
                    str.unshift(chr);
                    return [[this_int, is_float ? "float" : "int"], str];
                }
                this_int += chr;
            }
        
            return [[this_int, is_float ? "float" : "int"], str];
        }
        
        function lex_bool (str) {
            return _any([
                (str) => _match_str("true", "bool", str),
                (str) => _match_str("false", "bool", str)
            ], str);
        }
        
        function lex_null (str) {
            return _match_str("null", "builtin", str);
        }
        
        function lex_token (str) {
            if (JSON_TOKEN.includes(str[0])) return [[str.shift(), "token"], str];
            return [null, str];
        }
        
        return function lex (str) {
            var tokens = [];
            str = [...str];
        
            while (str.length > 0) {
                [result, rest] = _any([
                    lex_bool, lex_null, lex_num, lex_str, lex_token
                ], str);
                str = rest;
                if (result) tokens.push(result);
                if (!result) throw `lex: unexpected token: ${str}`;
        
                if (str[0] == JSON_SPACE) str.shift();
            }
        
            return tokens;
        }
    })();
    
    var parse = (function () {
        function par_array (tokens) {
            var arr = [];
            var elem_exp = false;
        
            while (tokens.length > 0) {
                var [[elem, type], tokens] = par(tokens);
                if (type == 'token') {
                  if (elem == JSON_ARRR)
                      if (!elem_exp) return [[arr, "array"], tokens];
                      else throw "par_array: unexpected ','";
                  else throw "par_array: unexpected token.";
                }
                arr.push(elem);
        
                if (tokens.length < 1) throw "par_array: unexpected end of file";
        
                [elem, type] = tokens.shift();
                if (type == 'token') {
                    if (elem == JSON_ARRR) return [[arr, "array"], tokens];
                    else if (elem == JSON_COMA)  elem_exp = true; // bad
                    else throw "par_array: unexpected token.";
                } else throw "par_array: unexpected token.";
            }
        
            throw "par_array: unexpected end of file";
        }
    
        function par_obj (tokens) {
            var obj = {};
            var obj_exp = false;
        
            while (tokens.length > 0) {
                var [[key, type], tokens] = par (tokens);
                if (type == 'token')
                    if (key == JSON_BR) return [[obj, "object"], tokens];
                    else throw "unexpected token."
        
               if (tokens.length < 2) throw "par_obj: unexpected end of file";
        
               var [[tkn, type], tokens] = par (tokens);
               if (type == 'token' && tkn == JSON_COL) {
                   var [[value, type], tokens] = par (tokens);
                   if (type != "token") obj[key] = value;
               } else throw "unexpected token."
        
               if (tokens.length < 1) throw "par_array: unexpected end of file";
        
               [elem, type] = tokens.shift();
               if (type == 'token') {
                    if (elem == JSON_BR) return [[obj, "object"], tokens];
                    else if (elem == JSON_COMA)  obj_exp = true; // bad
                    else throw "par_obj: unexpected token.";
                } else throw "par_obj: unexpected token.";
            }
        }
        
        function par (tokens) {
            var [tkn, type] = tokens.shift();
        
            if (tkn == JSON_ARRL && type == "token") return par_array(tokens);
            if (tkn == JSON_BL && type == "token") return par_obj(tokens);
        
            if (type == "int") return [[Number.parseInt(tkn), type], tokens]; // TODO: parseInt ignore eng
            if (type == "float") return [[Number.parseFloat(tkn), type], tokens];
            return [[tkn, type], tokens];
        }
        
        return function parse (str) {
            var [parsed, unparsed] = par(lex(str));
            return {parsed, unparsed};
        }
    })();
    
    return {parse, lex};
})();