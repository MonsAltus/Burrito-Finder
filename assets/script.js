/*function getLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(burritofinder);
    } else {
      x.innerHTML = "Geolocation is not supported by this browser.";
    }
  }

function burritofinder(position) {
   
    var latitude = position.coords.latitude;
    var longitude = position.coords.longitude;
    var settings = {
        //concatenat latitude and longitude
        "url": "https://api.yelp.com/v3/businesses/search?latitude="+latitude+"&longitude="+longitude,
        "method": "GET",
        "timeout": 0,
        "headers": {
           "Authorization": "Bearer dvH3CsRPIr4UkWtnLkEOMnGj-KiNkj6pwhHSqnKdanToZuAWanDhTLFwycI2mB_5ZLm3lvmJ9LdFCdtanWXkPKmyUi2wVRZRY2oYXuz5WcUDxz6f-dYe--YT57p3YHYx",
         //allows additional websites to use yelp API
         "Access-Control-Allow-Origin": "*"
        },
      };
      
      $.ajax(settings).done(function (response) {
        console.log(response);
      });
}

burritofinder(getLocation());
*/

function getResults(zip) {
    // or
    // function getResults(lat, lng) {
    $.ajax({
        type: "GET",
        contentType: "application/json; charset=utf-8",
        // submit a get request to the restful service zipSearch or locSearch.
        url: "http://search.ams.usda.gov/farmersmarkets/v1/data.svc/zipSearch?zip=" + zip,
        // or
        // url: "http://search.ams.usda.gov/farmersmarkets/v1/data.svc/locSearch?lat=" + lat + "&lng=" + lng,
        dataType: 'jsonp',
        jsonpCallback: 'searchResultsHandler'
    });
}
//iterate through the JSON result object.
function searchResultsHandler(searchResults) {
    for (var key in searchresults) {
        alert(key);
        var results = searchresults[key];
        for (var i = 0; i < results.length; i++) {
            var result = results[i];
            for (var key in result) {
                //only do an alert on the first search result
                if (i == 0) {
                    alert(result[key]);
                }
            }
        }
    }
}

function getDetails(id) {
    $.ajax({
        type: "GET",
        contentType: "application/json; charset=utf-8",
        // submit a get request to the restful service mktDetail.
        url: "http://search.ams.usda.gov/farmersmarkets/v1/data.svc/mktDetail?id=" + id,
        dataType: 'jsonp',
        jsonpCallback: 'detailResultHandler'
    });
}
//iterate through the JSON result object.
function detailResultHandler(detailresults) {
    for (var key in detailresults) {
        alert(key);
        var results = detailresults[key];
        alert(results['GoogleLink']);
    }
}