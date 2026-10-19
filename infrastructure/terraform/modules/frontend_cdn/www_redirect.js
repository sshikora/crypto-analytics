function handler(event) {
  var request = event.request;
  var host = request.headers.host.value;

  if (host.indexOf('www.') !== 0) {
    return request;
  }

  var params = [];
  Object.keys(request.querystring).forEach(function (key) {
    var param = request.querystring[key];
    var values = param.multiValue ? param.multiValue : [param];
    values.forEach(function (v) {
      params.push(v.value === '' ? key : key + '=' + v.value);
    });
  });

  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: {
        value: 'https://' + host.slice(4) + request.uri + (params.length ? '?' + params.join('&') : ''),
      },
    },
  };
}
