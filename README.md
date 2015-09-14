# bindjs
Tiny but powerful double-binding javascript library using Object.observe

Minified, gzipped, this libraries only weights **1.5ko** !

## How to use

### Browser

BindJs is based on **Object.observe** method, that should be available only on ES7.<br>
For this reason, for the moment, only **Chrome** and **Safari** can support BindJS.

For more information, click [here](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Object/observe).

### Example

You can use BindJs by calling the global function **Bind** on a specified element of the dom.

```html
<html>
  <head>
    <script src="bind.js"></script>
  </head>
  <body>
    <div><input type=text ?val="myVar"></div>
    <div>?{myVar}</div>
    <script>
      Bind(document.body, {myVar:"This is my binded variable."})
    </script>
  </body>
</html>
```

## Features

All BindJs HTML binders use the **'?'** marker.

### Text

```html
<div>Show content of myVar: ?{myVar}</div>
```

Other way, to do the same thing:

```html
<div>Show content of myVar: <span ?text="myVar"></span></div>
```

### Html

```html
<div>Parse content of myVar as html: <span ?html="myVar"></span></div>
```

### Show

```html
<div>Show an element only if myVar is equivalent to true: <span ?if="myVar">myVar is true</span></div>
```

### Loops

```html
<div>Duplicate an element if function of the content of myArray: <ul><li ?for="key,val in myArray">element of key:?{key}, and value:?{val}</li></ul></div>
```

### Value

```html
<div>Change value of myVar with an input: <input ?val="myVar"></input></div>
```

### Listeners

All HTML native listeners beginning with **'on'** have an associated binder.

```html
<div>update value of myVar when clicking the button<button ?onclick="myVar+=1"></button></div>
```

### Evaluation

You can put any javascript expression in binders, as they will be evaluated as javascript functions.

The **return** keyword is requested if the binder content has several instructions (and if you need to retrieve a value in your binder).

```html
<div>Show a complex modification of myVar: ?{var pi=3.14; return (myVar+pi)/5.0}</div>
```