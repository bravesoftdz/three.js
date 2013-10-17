/**
 * @author David Griffiths https://github.com/dogriffiths
 */

THREE.Animatic = function() {
}

THREE.Animatic.Objects = [];
THREE.Animatic.Attributes = [];

//
// These are the major functions.
//

THREE.Animatic.stopAllAnimation = function() {
    THREE.Animatic.Objects = [];
    THREE.Animatic.Attributes = [];
}

THREE.Animatic.Sequencer = function() {
}

/**
 * Animate an attribute of an object to some value.
 *
 *   animate(<object>, <attribute-name>, <to-value>, <how-many-secs>=0.5)
 *
 * For example, to animate the left-position of an object called heading
 * to 300px in 4 seconds, use:
 *
 *   animate(heading.style, "left", 300, 4);
 *
 */
THREE.Animatic.animate = function(obj, binding, howManySecs, doAfter) {
  var b, result, attrName;
  if ((Object.prototype.toString.call(binding) === '[object Array]') && (binding.length > 0)) {
    result = THREE.Animatic.animate(obj, binding[0], howManySecs / binding.length);
    if (binding.length > 1) {
      result.next = function() {
        THREE.Animatic.animate(obj, binding.slice(1, binding.length), 
          howManySecs * (binding.length - 1) / binding.length, doAfter);
      }
    } else if (doAfter) {
      result.next = doAfter;
    }
  } else {
    for (attrName in binding) {
      b = binding[attrName];
      if (typeof b == "number") {
        result = THREE.Animatic.animateSingle(obj, attrName, b, howManySecs);
      } else if (typeof b == "object") {
        result = THREE.Animatic.animate(obj[attrName], b, howManySecs);
      }
    }
    if (doAfter) {
      result.next = doAfter;
    }
  }
  return result;
}

THREE.Animatic.animateSingle = function (obj, attrName, targetValue, howManySecs) {
    var animatorFn;
    var t = howManySecs || 0.25;
    var seq = new THREE.Animatic.Sequencer();
    if (obj[attrName] instanceof Array) {
        for (var i = 0; i < obj[attrName].length; i++) {
            var itemObject = new Object();
            itemObject["_object"] = obj;
            itemObject["_attr"] = "" + attrName;
            itemObject["_item_" + i] = obj[attrName][i];
            animatorFn = THREE.Animatic.runner(t, obj[attrName][i], targetValue[i], obj, attrName, seq);
            THREE.Animatic.animateWithAnimator(itemObject, "_item_" + i, animatorFn);
        }
    } else {
        animatorFn = THREE.Animatic.runner(t, obj[attrName], targetValue, obj, attrName, seq);
        THREE.Animatic.animateWithAnimator(obj, attrName, animatorFn);
    }
    return seq;
}

THREE.Animatic.rotate = function(obj, binding) {
  var attrName;
  for (attrName in binding) {
    if (typeof binding[attrName] == "number") {
      THREE.Animatic.rotateSingle(obj, attrName, binding[attrName]);
    } else if (typeof binding[attrName] == "object") {
      THREE.Animatic.rotate(obj[attrName], binding[attrName]);
    }
  }
}

THREE.Animatic.rotateSingle = function(obj, attrName, rpm) {
    var animatorFn = THREE.Animatic.rotator(3.14159265358979 * 2.0 / rpm);
    THREE.Animatic.animateWithAnimator(obj, attrName, animatorFn);
}

/**
 * Stop the animation for a given object/attribute. If the attribute-name
 * is not given, THREE.Animatic method will stop the animation of all attributes on
 * the object.
 *
 *   stopAnimation(<object>, [<attribute-name>])
 */
THREE.Animatic.stopAnimation = function(obj, attrNameValue)
{
    var attrName = attrNameValue || "";
    for (var i = THREE.Animatic.Objects.length - 1; i >= 0; i--) {
        var o = THREE.Animatic.Objects[i];
        var a = THREE.Animatic.Attributes[i];
        if ((o == obj) && ((a == attrName) || (attrName = ""))) {
            THREE.Animatic.Objects.splice(i, 1);
            THREE.Animatic.Attributes.splice(i, 1);
        }
    }
}

//
// And these are the rest
//

THREE.Animatic.animateWithAnimator = function(obj, attrName, animatorFn) {
    obj["animatic_" + attrName] = animatorFn;
    for (var i = THREE.Animatic.Objects.length - 1; i >= 0; i--) {
        var o = THREE.Animatic.Objects[i];
        var a = THREE.Animatic.Attributes[i];
        if ((o == obj) && (a == attrName)) {
            THREE.Animatic.Objects.splice(i, 1);
            THREE.Animatic.Attributes.splice(i, 1);
        }
    }
    THREE.Animatic.Objects.push(obj);
    THREE.Animatic.Attributes.push(attrName);
}

// Now repaint every 10 ms.
setInterval(function() {
    THREE.Animatic.updateAll()
}, 10);

THREE.Animatic.updateAll = function() {
    var i;
    for (i in THREE.Animatic.Objects) {
        var obj = THREE.Animatic.Objects[i];
        var attrName = THREE.Animatic.Attributes[i];
        var units = THREE.Animatic.unitsFor(obj[attrName]);
        var newValue = obj["animatic_" + attrName]();
        newValue = Math.round(newValue * 1000) / 1000;
        if (attrName.match("^_item_")  == "_item_") {
            var origObject = obj["_object"];
            var origAttr = obj["_attr"];
            var origIndex = eval(attrName.substring(6));
            origObject[origAttr][eval(origIndex)] = THREE.Animatic.addUnitsTo("" + newValue, units);
        } else {
            obj[attrName] = THREE.Animatic.addUnitsTo("" + newValue, units);
        }
    }
}

THREE.Animatic.stripUnits = function(s) {
    return ("" + s).replace( /[a-z%]/ig, "");
}

THREE.Animatic.unitsFor = function(s) {
    return ("" + s).replace( /[0-9.-]+/ig, "?");
}

THREE.Animatic.addUnitsTo = function(s, u) {
    if (u == "?") {
        return eval(s);
    }
    if (u.match(/\?.+\?/)) {
        throw "Animatic cannot animate an attribute with multiple parameters: '" + u + "'";
    }
    return u.replace( /\?/ig, "" + s);
}

THREE.Animatic.now = function() {
    return (new Date()).valueOf();
}

//
// The animator factories
//

THREE.Animatic.runner = function(p, fromValue, toValue, obj, attrName, seq) {
    var v1 = eval(THREE.Animatic.stripUnits(fromValue + ""));
    var v2 = eval(THREE.Animatic.stripUnits(toValue + ""));
    var now = THREE.Animatic.now();
    var then = now + (p * 1000);
    var seqRun = false;
    return function() {
        var justNow = THREE.Animatic.now();
        if (justNow >= then) {
            THREE.Animatic.stopAnimation(obj, attrName);
            if (!seqRun) {
                seqRun = true;
                if (seq.next) {
                    seq.next();
                }
            }
            return v2;
        }
        var prop = (justNow - now) / (then - now);
        return v1 + (Math.sin(prop * Math.PI / 2) * (v2 - v1));
    }
}

THREE.Animatic.rotator = function(p) {
    var now = THREE.Animatic.now();
    var then = now + (Math.abs(p) * 1000);
    var sign = (p < 0) ? -1 : 1;
    return function() {
        var justNow = THREE.Animatic.now();
        if (justNow >= then) {
            now = justNow;
            then = now + (Math.abs(p) * 1000);
        }
        var prop = (justNow - now) / (then - now);
        return sign * prop * 2.0 * 3.14159265358979;
    }
}
