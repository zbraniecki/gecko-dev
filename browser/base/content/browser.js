var x = 1;
var str = "";
for (var i = 0; i < 1; i++) {
  var bundle = document.getElementById("bundle" + i);
  for (var j = 0; j < 10; j++) {
    str += bundle.getString("prop.entity.id." + i + "" + j);
  }
}
document.getElementById("props").innerHTML = str
var y = 2;
