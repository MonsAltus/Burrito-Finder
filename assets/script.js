/*
1. get a list of the farmers markets relative to a zipcode.
2. plot the farmers markets into a google map, based on adddress.
3. automatically determin users location on page load.
4. allow users to save to a list.
*/

//Create an access token for the mapbox
mapboxgl.accessToken = 'pk.eyJ1IjoibWFpa2l0dHlnYW1pbmciLCJhIjoiY2tuc2U1cjBiMHB2NDJ2cjExcHc4YzJ6byJ9.UYEROaXgrVJ27dzy-ip-zA';

//Create a client for mapbox
var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [-100, 33],
  zoom: 2.5
});

//When the form for zipcodes is submitted send that to a series of handlers starting by getting a location from a zipcode.
$('#searchbyzip').submit(function(event){
  event.preventDefault();
  getmarketbyzip($('input[name=zip]').val());
});

function getmarketbyzip(zip) {
  // console.log(zip)
  //Make an api Request and send the results to the zipHandler function.
  $.ajax({
    type: "GET",
    contentType: "application/json; charset=utf-8",
    url: "https://search.ams.usda.gov/farmersmarkets/v1/data.svc/zipSearch?zip=" + zip,
    dataType: 'jsonp',
    jsonpCallback: 'zipHandler'
  });
}

//Sends the results of the zip code search to start getting details on each item.
function zipHandler(searchresults) {
  getmarketbyid(searchresults.results.slice(0, 10));
  // console.log(searchresults.results)
}

function getmarketbyid(searchresults) {
  // console.log(searchresults)
  var detailResultsArray = []
  //Foreach item in the search results make an api request to get the full details. Send the results to detailResultHandler function.
  searchresults.forEach(function(item) {
    $.ajax({
      type: "GET",
      contentType: "application/json; charset=utf-8",
      url: "https://search.ams.usda.gov/farmersmarkets/v1/data.svc/mktDetail?id=" + item.id,
      dataType: 'jsonp',
      // jsonpCallback: 'detailResultHandler'
      success: function(result) {
        detailResultsArray.push({result: result, marketName: item.marketname.slice(4).trim()})
        if (detailResultsArray.length === searchresults.length) {
          if (map.getSource("places")) {
            map.getSource('places').setData(generateSource(detailResultsArray, true));
          } else {
            // Add a layer showing the places.
            map.addSource('places', generateSource(detailResultsArray));
            // console.log(map.getSource("places"))
            map.addLayer({
              'id': 'places',
              'type': 'circle',
              'source': 'places',
              'paint': {
                'circle-color': '#4264fb',
                'circle-radius': 6,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
              }
            })
          }
        }
      }
    });
  });
}

  function generateSource(detailResultsArray, sourceExists=false) {
    // console.log(detailResultsArray)
    var featuresArray = []
    var marketDisplayList = $('#projectedList')
    //Clears projectedList element before populating with new data when a new location is searched.
    marketDisplayList.html("")
    for (let index = 0; index < detailResultsArray.length; index++) {
      const element = detailResultsArray[index];
      var link = new URL(element.result.marketdetails.GoogleLink)
      var params = new URLSearchParams(link.search)
      var coordinates = [params.get("q").split("(")[0].split(",")[1],params.get("q").split("(")[0].split(",")[0]]
      // console.log(coordinates)
      // console.log(element.marketName)
      // console.log(element)
      // console.log(element.result.marketdetails.GoogleLink)
      var featureObject = {
        'type': 'Feature',
        'properties': {
          'description':
          `<p><strong>${element.marketName}</strong><br>${element.result.marketdetails.Address}<br><strong>Schedule: </strong>${element.result.marketdetails.Schedule}<strong>Products: </strong>${element.result.marketdetails.Products}</p>`
        },
        'geometry': {
          'type': 'Point',
          'coordinates': coordinates
        }
      }
      featuresArray.push(featureObject);
      $('#projectedList').append('<li>'+element.marketName+' <button class="favoriteBtn" data-title="'+element.marketName+'" data-link="'+link+'">Favorite</button>  </li>');
    }
    // Move map to first pin in array and zoom in.
    map.flyTo({center: featuresArray[0].geometry.coordinates, zoom: 9});
    if (sourceExists) {
      return {
        'type': 'FeatureCollection',
        'features': featuresArray
      }
    } else {
      var sourceGeoJson = {
        'type': 'geojson',
        'data': {
          'type': 'FeatureCollection',
          'features': featuresArray
        }
      }
    return sourceGeoJson;
  }
}

  map.on('load', function () {
    // Create a popup, but don't add it to the map yet.
    var popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false
    });

    map.on('mouseenter', 'places', function (e) {
      // Change the cursor style as a UI indicator.
      map.getCanvas().style.cursor = 'pointer';

      var coordinates = e.features[0].geometry.coordinates.slice();
      var description = e.features[0].properties.description;

      // Ensure that if the map is zoomed out such that multiple
      // copies of the feature are visible, the popup appears
      // over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      // Populate the popup and set its coordinates
      // based on the feature found.
      popup.setLngLat(coordinates).setHTML(description).addTo(map);
    });

    map.on('mouseleave', 'places', function () {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });
});

//Store the element we should append list items to.
var htmlListElement = $('#favoritesList');

function readItems() {
  //Read and parse the array from localstorage
  var items = JSON.parse(localStorage.getItem('markets'));
  //Loop through each list item

   //Make sure there is data that can be read or you will error
  if (items != null) {
    items.forEach(function(item){
      //Add each entry to the favorites list.
      htmlListElement.append('<li><a href="'+item[1]+'">'+item[0]+'</a></li>');
    });
  }
}

readItems();

// Adds item to favorites list when clicked.
$(document).on('click', '.favoriteBtn', function(event){
  event.preventDefault();
  //Read the existing localStorage
  var items = JSON.parse(localStorage.getItem('markets'));
  if (items == null) {
    items = new Array();
  }
  var title = $(this).attr('data-title');
  var link = $(this).attr('data-link');
  var itemData = [title, link];
  //Push the new item into the read data.
  items.push(itemData);
  //Write back into localstorage but stringify the data so we can use a single array.
  localStorage.setItem('markets', JSON.stringify(items));
  //Add the list item to the page.
  // htmlListElement.append('<li><a href="'+link+'">'+title+'</a></li>');
  htmlListElement.append('<li><a href="https://www.google.com/maps/search/'+title+'">'+title+'</a></li>');
});

// Clears favorites list when clicked.
$(document).on("click", ".clear-storage", function(){
  localStorage.clear()
  htmlListElement.html("")
});