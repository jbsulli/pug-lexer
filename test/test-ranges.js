const readline = require('readline');
const chalk = require('chalk');
const fs = require('fs');
const lex = require('../');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const dir = path.join(__dirname, 'cases');

var files = [];
var file, src, expected_tokens, actual_tokens, pos, last_line;

// modes
var mode_json = true;
var mode_move_start = false;
var mode_show_token = false;

fs.readdirSync(dir).forEach(file => {
    if(/\.pug$/.test(file)){
        files.push(file);
    }
});

function initLoc(l, file){
    if(!l || typeof l !== 'object'){
        return {
            start: setPosInitial(),
            end: setPosInitial(),
            filename: file
        };
    }
    if(!('filename' in l) || typeof l.filename !== 'string'){
        l.filename = file;
    }
    l.start = setPosInitial(l.start);
    l.end = setPosInitial(l.end);
    return l;
}

function setColumn(l, column){
    l.column = column;
    if(l.column < 1){
        l.column = 1;
    }
    else if(l.column > src[l.line - 1].length + 1){
        l.column = src[l.line - 1].length + 1;
    }
}

function setLineStart(l, line){
    l.line = line;
    
    if(line < 1){
        line = 1;
    }
    else if(line > src.length){
        line = src.length;
    }
    
    l.column = 1;
}

function setLineEnd(l, line){
    l.line = line;
    
    if(line < 1){
        line = 1;
    }
    else if(line > src.length){
        line = src.length;
    }
    
    l.column = src[l.line - 1].length + 1;
}

function setPos(l, copy){
    setLineStart(l, copy.line);
    setColumn(l, copy.column);
}

function setPosInitial(l){
    if(!l || typeof l !== 'object'){
        return { line:0, column:0 };
    }
    l.line = ('line' in l && typeof l.line === 'number' ? l.line : 0);
    l.column = ('column' in l && typeof l.column === 'number' ? l.column : 0);
    return l;
}

function fixEndpoints(l, s, f, min_line){
    if(!min_line || min_line < 1) min_line = 1;
    
    // if the line matches the start line, use the start column
    if(min_line > l.start.line){
        setLineStart(s, min_line);
    }
    else {
        setPos(s, l.start);
    }
    
    if(l.end.line >= s.line){
        setPos(f, l.end);
    } else {
        setPos(f, s);
    }
    
    if(s.line === f.line && f.column < s.column){
        f.column = s.column;
    }
}

function nextFile(){
    if(files.length === 0){
        rl.close();
        return;
    }
    
    file = files.shift();
    
    const filepath = path.join(dir, file);
    const expectedpath = filepath.replace(/\.pug$/, '.expected.json');
    src = fs.readFileSync(filepath, 'utf8');
    actual_tokens = lex(src, { filename: '/cases/' + file });
    expected_tokens = fs.readFileSync(expectedpath, 'utf8').split(/\n/).map(JSON.parse);
    last_line = pos = 0;
    src = src.split(/(?:\r\n|\n|\r)/g);
    process.nextTick(nextToken);
}

function nextToken(){
    
    if(pos >= Math.max(actual_tokens.length, expected_tokens.length)){
        process.nextTick(nextFile);
        return;
    }
    
    var actual = actual_tokens[pos];
    var expected = expected_tokens[pos];
    
    actual.loc = initLoc(actual.loc);
    expected.loc = initLoc(expected.loc);
    
    const a = actual.loc;
    const e = expected.loc;
    
    const match = (
        a.filename &&
        a.filename === e.filename &&
        a.start.line === e.start.line &&
        a.start.column === e.start.column &&
        a.end.line === e.end.line &&
        a.end.column === e.end.column ? true : false);
    
    process.stdout.write('\x1B[2J\x1B[0f');
    console.log(chalk.white(e.start.line + ':' + e.start.column), chalk.gray('to'), chalk.white(e.end.line + ':' + e.end.column));
    
    if(mode_show_token){
        console.log(JSON.stringify(actual, null, 4));
        console.log(JSON.stringify(expected, null, 4));
    }
    
    var i, t, l, j;
    var s = {};
    var f = {};
    
    var use_actual = false;
    
    if(e.end.line === 0 || e.end.column === 0 || e.start.line === 0 || e.start.column === 0){
        use_actual = true;
    }
    
    fixEndpoints((use_actual ? a : e), s, f, last_line);
    last_line = s.line;
    
    console.log(chalk[match ? 'green' : 'red'](file.replace(/\.pug$/, '')), chalk.gray('@'), chalk.white(pos + 1) + chalk.gray(':'), chalk.white(`${s.line}:${s.column}`) + chalk.gray(' to ') + chalk.white(`${f.line}:${f.column}`));
    console.log(chalk.white((actual ? ('' + actual.type).toUpperCase() || 'undefined' : 'undefined')));
    
    /*if(match){
        pos++;
        process.nextTick(nextToken);
        return;
    }*/
    
    setPos(expected.loc.start, s);
    setPos(expected.loc.end, f);
    
    var bg = (mode_move_start ? 'bgBlue' : 'bgGreen');
    
    for(i = s.line - 2; i < f.line + 3; i++){
        t = src[i - 1];
        
        if(i > src.length || i < 1){
            t = chalk.bgRed(' ');
        } else {
            if(i < s.line || i > f.line){
                t = chalk.gray((mode_json ? JSON.stringify(t) : t));
            } else {
                if(i > s.line && i < f.line){
                    t = chalk.white[bg]((mode_json ? JSON.stringify(t) : t));
                }
                else if(i === s.line && i === f.line && s.column === f.column){
                    if(s.column < src[s.line - 1].length + 1){
                        l = '';
                        
                        j = t.substr(0, s.column - 1);
                        if(mode_json){
                            j = JSON.stringify(j);
                            j = j.substr(1, j.length - 2);
                        }
                        l += chalk.gray(j);
                        
                        j = t.substring(s.column - 1, f.column);
                        if(mode_json){
                            j = JSON.stringify(j);
                            j = j.substr(1, j.length - 2);
                        }
                        l += chalk.grey[bg](j);
                        
                        j = t.substr(f.column);
                        if(mode_json){
                            j = JSON.stringify(j);
                            j = j.substr(1, j.length - 2);
                        }
                        l += chalk.gray(j);
                        
                        t = (mode_json ? chalk.gray('"') + l + chalk.gray('"') : l);
                    } else {
                        if(mode_json){
                            l = JSON.stringify(t);
                            l = l.substr(0, l.length - 1);
                            j = '"';
                        } else {
                            l = t;
                            j = ' ';
                        }
                        t = chalk.grey(l) + chalk.grey[bg](j);
                    }
                }
                else if(i === s.line && i === f.line){
                    l = '';
                    
                    j = t.substr(0, s.column - 1);
                    if(mode_json){
                        j = JSON.stringify(j);
                        j = j.substr(1, j.length - 2);
                    }
                    l += chalk.gray(j);
                    
                    j = t.substring(s.column - 1, f.column - 1);
                    if(mode_json){
                        j = JSON.stringify(j);
                        j = j.substr(1, j.length - 2);
                    }
                    l += chalk.white[bg](j);
                    
                    j = t.substr(f.column - 1);
                    if(mode_json){
                        j = JSON.stringify(j);
                        j = j.substr(1, j.length - 2);
                    }
                    l += chalk.gray(j);
                    
                    t = (mode_json ? chalk.gray('"') + l + chalk.gray('"') : l);
                }
                else if(i === s.line){
                    l = '';
                    
                    j = t.substring(0, s.column - 1);
                    if(mode_json){
                        j = JSON.stringify(j);
                        j = j.substr(1, j.length - 2);
                    }
                    l += chalk.gray(j);
                    
                    j = t.substr(s.column - 1);
                    if(mode_json){
                        j = JSON.stringify(j);
                        j = j.substr(1, j.length - 2);
                    }
                    l += chalk.white[bg](j);
                    
                    t = (mode_json ? chalk.gray('"') + l + chalk.green[bg]('"') : l);
                }
                else if(i === f.line){
                    l = '';
                    
                    j = t.substring(0, f.column - 1);
                    if(mode_json){
                        j = JSON.stringify(j);
                        j = j.substr(1, j.length - 2);
                    }
                    l += chalk.white[bg](j);
                    
                    j = t.substr(f.column - 1);
                    if(mode_json){
                        j = JSON.stringify(j);
                        j = j.substr(1, j.length - 2);
                    }
                    l += chalk.gray(j);
                    
                    t = (mode_json ? chalk.green[bg]('"') + l + chalk.gray('"') : l);
                }
            }
        }
        
        console.log((i < 10 ? (i < 0 ? '  ' + i : '   ' + i) : (i < 100 ? '  ' + i : (i < 1000 ? ' ' + i : i))) + '|', t);
    }
    
    rl.question('    | ' + (mode_json ? ' ' : ''), (response) => {
        if(response === ''){
            saveToken();
            pos++;
            process.nextTick(nextToken);
            return;
        }
        
        var target;
        
        for(var i = 0; i < response.length; i++){
            target = (mode_move_start ? expected.loc.start : expected.loc.end);
            console.log(target.line + ':' + target.column);
            switch(response.charAt(i)){
                case 'a':
                    if(target.column > 1) target.column--;
                    else setLineEnd(target, target.line - 1);
                    break;
                case 'd':
                    if(target.column < src[target.line - 1].length + 1) target.column++;
                    else setLineStart(target, target.line + 1);
                    break;
                case 'x':
                    mode_json = !mode_json;
                    break;
                case 'z':
                    mode_show_token = !mode_show_token;
                    break;
                case 'c':
                    mode_move_start = !mode_move_start;
                    break;
            }
        }
        
        rl.question(target.line + ':' + target.column, () => {
            process.nextTick(nextToken);
        });
        
    });
}

function saveToken(){
    
}

nextFile();