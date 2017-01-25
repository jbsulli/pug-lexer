'use strict';

/*global describe:true, it:true*/

var fs = require('fs');
var lex = require('../');
var checkLexerFunctions = require('./check-lexer-functions');

var chai = require('chai');
var dirtyChai = require('dirty-chai');
var expect = chai.expect;
chai.use(dirtyChai);

checkLexerFunctions();

/**
 * Rework `token.loc.filename` so that the unit test results are always the same reguardless of 
 * OS/directory.
 * 
 * @param {Object} token
 * @returns {Object}
 * @api private
 */
function standardizeUnitTest(token){
  if(token.loc && token.loc.filename){
    if(token.loc.filename.substr(0, __dirname.length) === __dirname){
      token.loc.filename = token.loc.filename.substr(__dirname.length);
    }
    token.loc.filename = token.loc.filename.replace(/\\/g, '/');
  }
  return token;
}

/**
 * Get source string from `loc.start.line`:`loc.start.column` to `loc.end.line`:`loc.end.column`
 * 
 * @param {string} src
 * @param {Object} loc
 * @returns {string}
 * @api private
 */
function getSourceString(src, loc){
  try {
    src = src.split(/\n/g);
    var s = src.slice(loc.start.line - 1,loc.end.line);
    s[s.length - 1] = s[s.length - 1].substr(0, loc.end.column - 1);
    s[0] = s[0].substr(loc.start.column - 1);
    return s.join('\n');
  } catch(err){
    return undefined;
  }
}

function newLoc(file, token){
  var line = token.line;
  var col = token.col;
  token.loc = {
    start: { line:line, column:col },
    filename: file,
    end: { line:0, column:0 }
  };
  delete token.line;
  delete token.col;
  return token;
}

var first = true;
var only = '';

describe('Pug Lexer', function(){
  describe.skip('cases', function(){
    var dir = __dirname + '/cases/';
      fs.readdirSync(dir).forEach(function (testCase) {
        if (/\.pug$/.test(testCase)) {
          var test = it;
          
          if(testCase === only){
            test = test.only;
          }
          
          test.skip(testCase, function(){
            
            var expected = fs.readFileSync(dir + testCase.replace(/\.pug$/, '.expected.json'), 'utf8')
                            .split(/\n/).map(JSON.parse);
            
            /*       
            fs.writeFileSync(
              dir + testCase.replace(/\.pug$/, '.expected.json'),
              expected
                .map(function(token){
                  return newLoc(dir + testCase.replace(/\.pug$/, '.pug'), token);
                })
                .map(standardizeUnitTest)
                .map(JSON.stringify)
                .join('\n')
            );//*/
          
            //*
            var src = fs.readFileSync(dir + testCase, 'utf8');
            var result = lex(src, {filename: dir + testCase});
            
            fs.writeFileSync(
              dir + testCase.replace(/\.pug$/, '.actual.json'),
              result
                .map(standardizeUnitTest)
                .map(JSON.stringify)
                .join('\n')
            );
                            
            // TODO: remove try...catch after getting source-ends to work
            try {
              expected.forEach(function(expected, i){
                expect(result[i]).to.deep.equal(expected, 'Token ' + i);
              });
            } catch(err){
              if(!first) throw err;
              first = false;
              try {
                expect(expected.map(t => t.loc)).to.deep.equal(result.map(t => t.loc));
              } catch(err){
                result.map(function(tok){
                  return console.log(
                    tok.type,
                    JSON.stringify(getSourceString(src, tok.loc)),
                    '[' +
                      (tok.loc && tok.loc.start ? 
                        ('line' in tok.loc.start ? tok.loc.start.line : '??') + ':' + 
                        ('column' in tok.loc.start ? tok.loc.start.column : '??') 
                      : '??:??'), 
                      (tok.loc && tok.loc.end ? 
                        ('line' in tok.loc.end ? tok.loc.end.line : '??') + ':' + 
                        ('column' in tok.loc.end ? tok.loc.end.column : '??') 
                      : '??:??') + 
                    ']'
                  );
                });
              }
              throw err;
            }//*/
          });
        }
      });
  });
  
  describe('errors', function(){var edir = __dirname + '/errors/';
    fs.readdirSync(edir).forEach(function (testCase) {
      if (/\.pug$/.test(testCase)) {
        it(testCase, function(){
          var expected = JSON.parse(fs.readFileSync(edir + testCase.replace(/\.pug$/, '.json'), 'utf8'));
          var actual;
          try {
            lex(fs.readFileSync(edir + testCase, 'utf8'), {filename: edir + testCase});
            throw new Error('Expected ' + testCase + ' to throw an exception.');
          } catch (ex) {
            if (!ex || !ex.code || ex.code.indexOf('PUG:') !== 0) throw ex;
            actual = {
              msg: ex.msg,
              code: ex.code,
              line: ex.line,
              column: ex.column
            };
          }
          expect(expected).to.deep.equal(actual);
        });
      }
    });
  });
});