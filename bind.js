(function(){
Bind = function(dom, scope) {
	// if dom is array, call Bind on its elements
	var len = dom.length;
	if(len!==undefined) {
		for(var d=0; d<len; ++d) Bind(dom[d], scope);
		return;
	}
	// replace ?{}
	rewriteContent(dom, scope);
	// parse ?<any> attributes
	bindAttrs(dom, [scope]);
};
var rewriteContent = function(dom, scope) {
	var html = dom.innerHTML;
	// replace all '?{myVar}' into '<span ?txt="myVar"></span>'
	var newHtml = html.replace(/\?{([^}]*)}/g, '<span ?txt="$1"></span>');
	// perf optim: re-write html only if necessary
	if(newHtml !== html) dom.innerHTML = newHtml;
};
var toStr = function(val) {
	return ( val===undefined || val===null ) ? "" : String(val);
};
var bindAttrs = function(dom, scopes) {
	var offset = 0;
	// for attribute
	if(dom.hasAttribute && dom.hasAttribute("?for")) {
		var expr = dom.getAttribute("?for");
		dom.removeAttribute("?for");
		var forObss = parseFor(expr), forArr = evalAsFunction(scopes, forObss.arr)(), forIdx = forObss.idx;
		var parentDom = dom.parentNode, endDom = dom.nextSibling, forObjs = [];
		parentDom.removeChild(dom);
		offset = -1 + forArr.length;
		// create initial for doms
		for(var a=0, len=forArr.length; a<len; ++a) forObjs.push({});
		syncForDoms(scopes, forArr, forObjs, forIdx, [], dom, parentDom, endDom);
		// array observer
		Array.observe(forArr, function(changes){
			var removedObjs = [];
			for(var c=0, len=changes.length; c<len; ++c){
				var change = changes[c], type = change.type, index = change.index;
				if(type=="splice") var nbRemoved = change.removed.length, nbAdded = change.addedCount;
				else if(type=="update") var nbRemoved = 1, nbAdded = 1;
				if(nbRemoved>0) removedObjs = removedObjs.concat(forObjs.splice(index, nbRemoved));
				for(var a=0; a<nbAdded; ++a) forObjs.splice(index, 0, {});
			}
			syncForDoms(scopes, forArr, forObjs, forIdx, removedObjs, dom, parentDom, endDom);
		});
	} else {
		var attrs = dom.attributes;
		if(attrs) {
			// store all bindable attributes before any modification of the dom (that would add/remove some attrs)
			var bindableAttrs = []
			for(var a=0, len=attrs.length; a<len; ++a) if(attrs[a].name.charAt(0)=='?') bindableAttrs.push(attrs[a])
			// loop on bindable attributes
			for(var a=0, len=bindableAttrs.length; a<len; ++a) {
				var attr = bindableAttrs[a], name = attr.name, expr = attr.value;
				var exprObjs = evalObjects(scopes, expr), exprFun = evalAsFunction(scopes, expr, exprObjs);
				var objToDom = null, domToObj = null, domToObjEvt = null;
				if(name=="?if") {
					objToDom = (function(exprFun){ return function(){ dom.style.display = exprFun() ? null : "none"; } })(exprFun);
				} else if(name=="?txt") {
					objToDom = (function(exprFun){ return function(){ var val = toStr(exprFun()); if(val != dom.textContent) dom.textContent = val; } })(exprFun);
					if(dom.getAttribute("contenteditable")) domToObj = oneObjUpdater(exprObjs, function() { return dom.textContent; });
					domToObjEvt = "input";
				} else if(name=="?html") {
					objToDom = (function(exprFun){ return function(){ var val = toStr(exprFun()); if(val != dom.innerHTML) dom.innerHTML = val; } })(exprFun);
					if(dom.getAttribute("contenteditable")) domToObj = oneObjUpdater(exprObjs, function() { return dom.innerHTML; });
					domToObjEvt = "input";
				} else if(name=="?val" || name=="?value") {
					objToDom = (function(exprFun){ return function(){ val = toStr(exprFun()); if(dom.value!==val) dom.value=val; } })(exprFun);
					domToObj = oneObjUpdater(exprObjs, function() { return dom.value; });
					domToObjEvt = "input";
				} else if(name.substring(0,3)==="?on") {
					domToObj = exprFun;
					domToObjEvt = name.substr(3);
				} else {
					objToDom = (function(attr, exprFun){ return function(val){ dom.setAttribute(attr, exprFun()); } })(name.substr(1), exprFun);
				}
				// listen obj & dom (if needed)
				if(objToDom) listenObjs(exprObjs, objToDom);
				if(domToObj) dom.addEventListener(domToObjEvt, domToObj);
				// inital binding
				var aloneObj = getObjectIfAlone(exprObjs);
				if(domToObj && aloneObj && aloneObj.lst[aloneObj.att]===null) domToObj();
				else if(objToDom) objToDom();
			}
		}
		// recursive call to sons
		for(var c=0, children=dom.children, len=children.length; c<len; ++c) {
			var off = bindAttrs(children[c], scopes);
			c+=off; len+=off;
		}
	}
	return offset;
};
var oneObjUpdater = function(exprObjs, updater) {
	var obj = getObjectIfAlone(exprObjs);
	if(!obj) return null;
	return function() {
		obj.lst[obj.att] = updater();
	}
};
var evalObjects = function(scopes, expr) {
	var objs = parseObjects(expr);
	for(var o=0, len=objs.length; o<len; ++o) {
		var obj = objs[o];
		var scopeNum = obj.scpN = findAssociatedScope(scopes, obj);
		if(scopeNum!==null) {
			var scope = obj.scp = scopes[scopeNum];
			obj.lst = evalObject(scope, obj.lstS), obj.att = evalObject(null, obj.attS);
		}
	}
	return objs;
};
var evalAsFunction = function(scopes, expr, exprObjs) {
	if(!exprObjs) exprObjs = evalObjects(scopes, expr);
	// define environment of function using scopes
	var pre = "";
	for(var s=0, len=scopes.length; s<len; ++s)  {
		pre += "var scope"+s+"=scopes["+s+"]; ";
	}
	// append scopes to variables
	var offset = 0;
	for(var o=0, len=exprObjs.length; o<len; ++o) {
		var obj = exprObjs[o];
		var numScope = obj.scpN;
		if(numScope!==null) {
			var scopeStr = "scope"+numScope+"."
			var idx = obj.idx + offset;
			expr = expr.slice(0, idx) + scopeStr + expr.slice(idx);
			offset += scopeStr.length;
		}
	}
	// prepend "return" for single instructions functions
	if(expr.indexOf(";")===-1) expr = "return "+expr;
	// create function
	var funStr = pre+"var fun=function(){"+expr+"}";
	eval(funStr);
	return fun;
};
var evalObject = function(scope, str) {
	// prepend scope is provided
	if(scope) str = "scope" + (str ? "."+str : "");
	return eval(str);
};
var findAssociatedScope = function(scopes, obj) {
	var headS = obj.headS;
	for(var s in scopes)
		if(headS in scopes[s])
			return s;
	return null;
};
var getObjectIfAlone = function(exprObjs) {
	// return first obj of expr if valid
	return (exprObjs.length===1 && exprObjs[0].lst) ? exprObjs[0] : null;
};
var listenObjs = function(exprObjs, updater) {
	for(var o=0, len=exprObjs.length; o<len; ++o) {
		var obj = exprObjs[o];
		if(obj.lst) {
			Object.observe(obj.lst, (function(attr){ return function(changes){
				for(var c=0, len=changes.length; c<len; ++c) {
					if(changes[c].name===attr){
						updater();
						return;
					}
				}
			}})(obj.att));
		}
	}
};
// function to extract objects with details from binding expressions
var regStartObj = /[_a-zA-Z]/;
var regObj = /[_a-zA-Z0-9]/;
var parseObjects = function(str) {
	// loop through binding expression, char to char
	var inString = false, objs = [], currentObj = null, openedObjs = [];
	for(var i=0, len=str.length; i<len; ++i) {
		var chr = str[i];
		// check if we are in a string
		if(!inString) { if(chr=="'" || chr=='"') { inString=chr; continue; } }
		else { if(chr==inString) { inString=false; } continue; }
		// check if we are at the beginning of an obj
		if(currentObj===null && regStartObj.exec(chr)) { currentObj={idxs:[i]}; objs.push(currentObj); }
		// check if we cross an index
		if(currentObj!==null && !regObj.exec(chr)) {
			currentObj.idxs.push(i);
			// check if we open obj
			if(chr=="[") openedObjs.push(currentObj);
			// check if we are still in the obj
			if(chr!=".") currentObj=null;
		}
		// check if we close an obj
		if(chr=="]") { currentObj = openedObjs.pop(); currentObj.idxs.push(i+1); }
	}
	// end of string check
	if(currentObj!==null) currentObj.idxs.push(len);
	// loop through objs and build details
	for(var o=0, len=objs.length; o<len; ++o) {
		var obj = objs[o], idxs=obj.idxs, nbIdx=idxs.length;
		// object position in binding expression
		obj.idx = idxs[0];
		// object first var
		obj.headS = str.substring(idxs[0], idxs[1]);
		// object last var
		var attS = str.substring(idxs[nbIdx-2], idxs[nbIdx-1]);
		if(nbIdx==2) attS = "'"+attS+"'";
		else if(attS[0]==".") attS = "'"+attS.slice(1)+"'";
		obj.attS = attS;
		// object part to listen
		if(nbIdx>2) obj.lstS = str.substring(idxs[0], idxs[nbIdx-2]);
	}
	return objs;
};
var parseFor = function(str) {
	var reg = /(.*) in (.*)/;
	var res;
	if(res = reg.exec(str)) {
		return {idx:res[1].split(','), arr:res[2]};
	} else {
		return {arr:str};
	}
};
var syncForDoms = function(scopes, forArr, forObjs, forIdx, removedObjs, modelDom, parentDom, endDom) {
	// remove doms
	for(var o=0, len=removedObjs.length; o<len; ++o) {
		var domToRemove = removedObjs[o].dom;
		if(domToRemove) parentDom.removeChild(domToRemove);
	}
	// add doms
	for(var len=forObjs.length, o=len-1; o>=0; --o) {
		var forObj = forObjs[o], forDom=forObj.dom;
		if(!forDom) {
			var nextDom = (o+1>=forObjs.length) ? endDom : forObjs[o+1].dom;
			var newDom = parentDom.insertBefore(modelDom.cloneNode(true), nextDom);
			forObj.dom = newDom;
			var newScopes = scopes;
			// fill index and value (if exists)
			if(forIdx) {
				var nbIdx = forIdx.length;
				if(nbIdx>0) {
					var keyAtt = forIdx[0];
					var newScope = {};
					newScope[keyAtt] = 0;
					var newScopes = scopes.slice();
					newScopes.push(newScope);
					forObj.keyObj = newScope;
					forObj.keyAtt = keyAtt;
					// number will be filled during renumbering
				}
				if(nbIdx>1) {
					var valAtt = forIdx[1];
					newScope[valAtt] = forArr[o];
				}
			}
			// bind new node
			bindAttrs(newDom, newScopes);
		}
	}
	// renumber
	for(var i=0, len=forObjs.length; i<len; ++i) {
		var forObj = forObjs[i], keyObj = forObj.keyObj, keyAtt = forObj.keyAtt;
		if(keyObj) keyObj[keyAtt] = i;
	}
};
}());
