module.exports = {
  apps : [{
    name   : "app1",
    script : "./app.js",
    instances: "max",
    exec_mode: "cluster",
  }]
}
