

/*
1. get a list of the farmers markets relative to a zipcode.
2. plot the farmers markets into a google map, based on adddress.
3. automatically determin users location on page load.
4. allow users to save to a list.
*/

//Create an access token for the mapbox
mapboxgl.accessToken = 'pk.eyJ1IjoibWFpa2l0dHlnYW1pbmciLCJhIjoiY2tuc2U1cjBiMHB2NDJ2cjExcHc4YzJ6byJ9.UYEROaXgrVJ27dzy-ip-zA';
//Create a client for mapbox
var mapboxClient = mapboxSdk({ accessToken: mapboxgl.accessToken });

//Request location services in the users browser
function getLocation() {
    if (navigator.geolocation) {
        //If the user has location services call back the location to the showPosition function.
        navigator.geolocation.getCurrentPosition(showPosition);
    }
}


function showPosition(position) {
    //Once the callback is activated render the map and center it on the retreived coordinates.
    var map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: {lat: position.coords.latitude, lng: position.coords.longitude},
        zoom: 10
    });
    
}

//Call Get Location to start the chain of events.
getLocation();


//When the form for zipcodes is submitted send that to a series of handlers starting by getting a location from a zipcode.
$('#searchbyzip').submit(function(event){
    event.preventDefault();
    getmarketbyzip($('input[name=zip]').val());
});



function getmarketbyzip(zip) {
    //Make an api Request and send the results to the zipHandler function.
    $.ajax({
        type: "GET",
        contentType: "application/json; charset=utf-8",
        url: "http://search.ams.usda.gov/farmersmarkets/v1/data.svc/zipSearch?zip=" + zip,
        dataType: 'jsonp',
        jsonpCallback: 'zipHandler'
    });
}

function getmarketbyid(searchresults) {
    //Foreach item in the search results make an api request to get the full details. Send the results to detailResultHandler function.
    searchresults.forEach(function(item) {
        $.ajax({
            type: "GET",
            contentType: "application/json; charset=utf-8",
            url: "http://search.ams.usda.gov/farmersmarkets/v1/data.svc/mktDetail?id=" + item.id,
            dataType: 'jsonp',
            jsonpCallback: 'detailResultHandler'
        });
    });
}


//Take the detail results and add a market to the map.
function detailResultHandler(detailresults) {
    //Transforms a regular address query string into a mappable marker.
    mapboxClient.geocoding
    .forwardGeocode({
        query: detailresults.marketdetails.Address,
        autocomplete: false,
        limit: 1
    })
    .send()
    .then(function (response) {
        if (
            response &&
            response.body &&
            response.body.features &&
            response.body.features.length
            ) {
                var feature = response.body.features[0];
                
                var map = new mapboxgl.Map({
                    container: 'map',
                    style: 'mapbox://styles/mapbox/streets-v11',
                    center: feature.center,
                    zoom: 10
                });
                
                //Creates and adds marker to the map as well as centers it.
                new mapboxgl.Marker().setLngLat(feature.center).addTo(map);
            }
        });
    }
    
    //Sends the results of the zip code search to start getting details on each item.
    function zipHandler(searchresults) {
        getmarketbyid(searchresults.results);
    }