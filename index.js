import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Text,
  TouchableOpacity,
} from 'react-native';
import MapView, {Callout, Marker, Polyline} from 'react-native-maps';
import axios from 'axios';
import {io} from 'socket.io-client';
import {SvgUri} from 'react-native-svg';

const TrackingOrder = (
  {
    type,
    Triplist,
    imeino,
    userCustomerId,
    BASE_URL 
  },

) => {
  const [socket, setSocket] = useState(null);
  const [socketResponse, setSocketResponse] = useState([]);
  const [socketIndex, setSocketIndex] = useState(null);
  const [startMarker, setStartMarker] = useState({
    id: "start",
    latitude: parseFloat(Triplist?.trip_start_latitude),
    longitude: parseFloat(Triplist?.trip_start_longitude),
  });

  const [endMarker, setEndMarker] = useState({
    id: "end",
    latitude: parseFloat(Triplist?.trip_end_latitude),
    longitude: parseFloat(Triplist?.trip_end_longitude),
  });

  const [stopMarkers, setStopMarkers] = useState([]);
  const [route, setRoute] = useState([]);
  const initializeSocket = async () => {
    if(socket?.connected)return

    const newSocket = io(BASE_URL);
    newSocket.on("connect", async () => {
      newSocket.emit("singleVehicle", {
        user_customer_id: userCustomerId,
        imei: imeino,
      });

      newSocket.on(`${imeino}`, (data) => {
        setSocketResponse(data);
      });

      newSocket.on("disconnect", () => {
        console.log("Disconnected from the socket");
      });

      setSocket(newSocket);
    });
  };

    useEffect(() => {
      initializeSocket();

      return () => {
        if (socket?.connected) {
          socket.disconnect();
        }
      };
    }, [Triplist,socket]);


  const fetchRoute = async () => {
    const waypoints = [
      `${startMarker.longitude},${startMarker.latitude}`,
      ...stopMarkers.map((marker) => `${marker.longitude},${marker.latitude}`),
      `${endMarker.longitude},${endMarker.latitude}`,
    ].join(";");
    const url = `http://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;
    try {
      const response = await axios.get(url);
      const coordinates = response.data.routes[0].geometry.coordinates.map(
        (coord) => ({
          latitude: coord[1],
          longitude: coord[0],
        })
      );
      setRoute(coordinates);
    } catch (error) {
      Alert.alert("Error", "Failed to fetch route");
    }
  };

  useEffect(() => {
    fetchRoute();
  }, [startMarker, endMarker, stopMarkers]);

  const addMarker = (e) => {
    if (type === "add") {
      const newMarker = {
        id: stopMarkers.length + 1,
        latitude: e.nativeEvent.coordinate.latitude,
        longitude: e.nativeEvent.coordinate.longitude,
      };
      setStopMarkers([...stopMarkers, newMarker]);
    }
  };

  const removeMarker = (id) => {
    setStopMarkers(stopMarkers.filter((marker) => marker.id !== id));
  };
  // Calculate bounding region
  const getBoundingRegion = () => {
    const markers = [startMarker, endMarker, ...stopMarkers];
    if (markers.length === 0) {
      return {
        latitude: 25.3548,
        longitude: 51.1839,
        latitudeDelta: 10,
        longitudeDelta: 10,
      };
    }

    const latitudes = markers.map((marker) => marker.latitude);
    const longitudes = markers.map((marker) => marker.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) * 1.5; // Adjust the factor as per your preference
    const lngDelta = (maxLng - minLng) * 1.5; // Adjust the factor as per your preference

    return {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  };
  //   console.log(socketResponse[0]?.latitude, 'thisSocketslat');
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={
          //
          getBoundingRegion()
        }
        onPress={addMarker}
      >
        <Marker
          key={startMarker.id}
          coordinate={{
            latitude: startMarker.latitude,
            longitude: startMarker.longitude,
          }}
          pinColor="green"
        />
        {socketResponse && socketResponse.length !== 0 && (
          <Marker
            coordinate={{
              latitude: parseFloat(socketResponse[0]?.latitude),
              longitude: parseFloat(socketResponse[0]?.longitude),
            }}
            title={"location"}
            description={"Marker Description"}
          >
            <TouchableOpacity
              style={{
                transform: [
                  { rotate: `${socketResponse[0].heading_angle}deg` },
                ],
              }}
            >
              <SvgUri
                uri={`${BASE_URL}/uploads/vehicle_type/${
                  socketResponse[0]?.vehicle_type_id
                }/${
                  socketResponse[0]?.metering_status === "A"
                    ? "Parked.svg"
                    : socketResponse[0]?.metering_status === "d"
                    ? "Idle.svg"
                    : socketResponse[0]?.metering_status === "B"
                    ? "Running.svg"
                    : socketResponse[0]?.metering_status === "U"
                    ? "Untracked.svg"
                    : ""
                }`}
                width={35}
                height={35}
                // rotation={45}
              />
            </TouchableOpacity>
          </Marker>
        )}

        {stopMarkers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{
              latitude: marker.latitude,
              longitude: marker.longitude,
            }}
            draggable
            onDragEnd={(e) => {
              const updatedMarkers = stopMarkers.map((m) =>
                m.id === marker.id
                  ? {
                      ...m,
                      latitude: e.nativeEvent.coordinate.latitude,
                      longitude: e.nativeEvent.coordinate.longitude,
                    }
                  : m
              );
              setStopMarkers(updatedMarkers);
            }}
            onCalloutPress={() => removeMarker(marker.id)}
          >
            <Callout>
              <View>
                <Text>Hello</Text>
                <TouchableOpacity onPress={() => console.log("press")}>
                  <Text>Remove</Text>
                </TouchableOpacity>
              </View>
            </Callout>
          </Marker>
        ))}
        <Marker
          key={endMarker.id}
          coordinate={{
            latitude: endMarker.latitude,
            longitude: endMarker.longitude,
          }}
          pinColor="blue"
        />

        {route.length > 0 && (
          <Polyline coordinates={route} strokeColor="hotpink" strokeWidth={3} />
        )}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default TrackingOrder;
