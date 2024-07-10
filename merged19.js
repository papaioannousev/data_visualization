document.addEventListener("DOMContentLoaded", function () {
  // Load CSV data for both map and line chart
  Promise.all([
    d3.csv("data.csv"),
    d3.json("https://unpkg.com/world-atlas@2.0.2/countries-50m.json"),
  ])
    .then(([data, world]) => {
      console.log("CSV Data loaded:", data);
      console.log("GeoJSON Data loaded:", world);

      // Parse data and extract year
      data.forEach((d) => {
        try {
          d.year = +d.CodeYear.slice(-4); // Extract last four characters as year
          d.eduExpPerPerson = +d["EDU Exp. Per Person Absolute"]; // Ensure this is a number
        } catch (error) {
          console.error("Error parsing data entry:", d, error);
        }
      });

      // Filter out entries that could not be parsed
      data = data.filter((d) => !isNaN(d.year) && !isNaN(d.eduExpPerPerson));

      // Sort data by year ascending
      data.sort((a, b) => a.year - b.year);

      // Populate country dropdown
      const countryDropdown = d3.select("#select-country");
      let countries = [...new Set(data.map((d) => d.Entity))]; // Get unique country names

      // Sort countries in ascending order
      countries.sort((a, b) => a.localeCompare(b));

      // Prepend "All Countries" option
      countries = ["All Countries", ...countries];

      countries.forEach((country) => {
        countryDropdown.append("option").text(country).attr("value", country);
      });

      // Define dimensions of the map container and SVG
      const mapContainer = d3.select("#map");
      const mapWidth = mapContainer.node().getBoundingClientRect().width;
      const mapHeight = mapContainer.node().getBoundingClientRect().height;

      // Define dimensions of the line chart container and SVG
      const lineChartContainer = d3.select("#chart");
      const lineChartWidth = lineChartContainer
        .node()
        .getBoundingClientRect().width;
      const lineChartHeight = lineChartContainer
        .node()
        .getBoundingClientRect().height;

      const legendContainer = d3.select("#legend");
      const legendContainerWidth = legendContainer
        .node()
        .getBoundingClientRect().width;
      const legendContainerHeight = legendContainer
        .node()
        .getBoundingClientRect().height;

      // Define line chart constants and dimensions
      const margin = { top: 20, right: 60, bottom: 60, left: 50 };
      const chartWidth = lineChartWidth;
      const chartHeight = lineChartHeight;

      // Calculate min and max values for x and y axes
      const minXValue = d3.min(data, (d) => d.year);
      const maxXValue = d3.max(data, (d) => d.year);
      const maxYValue = d3.max(data, (d) => d.eduExpPerPerson);

      // Create an SVG element for the map
      const svgMap = mapContainer
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .call(d3.zoom().on("zoom", zoomed)) // Initialize zoom behavior
        .append("g"); // Create a group element for the map

      // Create an SVG element for the line chart
      const svgLineChart = lineChartContainer
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Define line generator for the line chart
      const line = d3
        .line()
        .x((d) => xScale(d.year))
        .y((d) => yScale(d.eduExpPerPerson));

      // Define scales for x and y axes with fixed domains
      const xScale = d3
        .scaleLinear()
        .domain([minXValue, maxXValue]) // Fixed x-axis domain
        .range([0, chartWidth]);

      const yScale = d3
        .scaleLinear()
        .domain([0, maxYValue]) // Fixed y-axis domain from 0 to max value in data
        .nice()
        .range([chartHeight, 0]);

      // Draw x-axis
      svgLineChart
        .append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d")))
        .selectAll("text")
        .style("fill", "black")
        .selectAll("path, line")
        .style("stroke", "black");

      // Draw y-axis
      svgLineChart
        .append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .style("fill", "black")
        .selectAll("path, line")
        .style("stroke", "black");

      // Create tooltip for the line chart
      const tooltipLineChart = d3
        .select("#chart")
        .append("div")
        .attr("class", "tooltip-chart")
        .style("opacity", 0);

      // Group data by country
      const dataByCountry = d3.group(data, (d) => d.Entity);

      // Define colors for each country
      const color = d3.scaleOrdinal(d3.schemeCategory10);

      // Draw lines for each country
      dataByCountry.forEach((values, country) => {
        // Filter out undefined or NaN values for year and eduExpPerPerson
        values = values.filter(
          (d) => !isNaN(d.year) && !isNaN(d.eduExpPerPerson)
        );

        const path = svgLineChart
          .append("path")
          .datum(values)
          .attr("fill", "none")
          .attr("stroke", color(country))
          .attr("stroke-width", 2)
          .attr("d", line)
          .attr(
            "class",
            `line-${country.replace(/\s+/g, "-").replace(/[^\w-]/g, "")}`
          )
          .on("mouseover", (event, d) => {
            if (!path.classed("active")) {
              tooltipLineChart
                .style("opacity", 1)
                .html(
                  `Country: ${country}<br>Edu Exp Per Person: ${d3.format(
                    ".2f"
                  )(d[0].eduExpPerPerson)}`
                );
              path.attr("stroke-width", 4);
            }
          })
          .on("mousemove", (event) => {
            tooltipLineChart
              .style("left", event.pageX + 10 + "px")
              .style("top", event.pageY - 20 + "px");
          })
          .on("mouseout", () => {
            if (!path.classed("active")) {
              tooltipLineChart.style("opacity", 0);
              path.attr("stroke-width", 2);
            }
          })
          .on("click", () => {
            const isActive = path.classed("active");

            if (!isActive) {
              // Hide all other lines
              svgLineChart.selectAll("path").style("display", "none");

              // Hide all other dots
              svgLineChart.selectAll("circle").style("display", "none");

              // Show clicked line
              path.style("display", "initial").attr("stroke-width", 4);

              // Show dots of the clicked line
              svgLineChart
                .selectAll(
                  `.dot-${country.replace(/\s+/g, "-").replace(/[^\w-]/g, "")}`
                )
                .style("display", "initial");

              path.classed("active", true);

              // Update dropdown
              countryDropdown.property("value", country);

              function centerCountry(d) {
                const centroid = d3.geoCentroid(d);
                const rotate = projection.rotate();
                const newRotate = [-centroid[0], -centroid[1], rotate[2]];
                projection.rotate(newRotate);
                svgMap.selectAll(".country").attr("d", mapPath);
              }

              const selectedCountry = countrySelectorMap.node().value;
              svgMap.selectAll(".country").attr("fill", (d) => {
                const countryData = d.properties.eduExp;
                if (d.properties.name === selectedCountry) {
                  // Highlight the selected country
                  //centerCountry(d);
                  centerCountry(d);
                  return "#ffa500"; // orange color
                } else {
                  // Reset other countries to original fill color
                  return countryData === undefined
                    ? "#ccc"
                    : colorScale(countryData);
                }
              });

              updateChart(selectedCountry);
            } else {
              // Show all lines
              svgLineChart.selectAll("path").style("display", "initial");

              // Reset dots color to original
              svgLineChart.selectAll("circle").style("display", "initial");

              path.classed("active", false).attr("stroke-width", 2);
            }
          });

        // Add dots for each data point
        svgLineChart
          .selectAll(
            `.dot-${country.replace(/\s+/g, "-").replace(/[^\w-]/g, "")}`
          )
          .data(values)
          .enter()
          .append("circle")
          .attr(
            "class",
            `dot-${country.replace(/\s+/g, "-").replace(/[^\w-]/g, "")}`
          )
          .attr("cx", (d) => xScale(d.year))
          .attr("cy", (d) => yScale(d.eduExpPerPerson))
          .attr("r", 4)
          .attr("fill", color(country))
          .on("mouseover", (event, d) => {
            tooltipLineChart
              .style("opacity", 1)
              .html(
                `Country: ${country}<br>Year: ${
                  d.year
                }<br>Edu Exp Per Person: ${d3.format(".2f")(d.eduExpPerPerson)}`
              );
            d3.select(event.currentTarget).attr("r", 6);
          })
          .on("mousemove", (event) => {
            tooltipLineChart
              .style("left", event.pageX + 10 + "px")
              .style("top", event.pageY - 20 + "px");
          })
          .on("mouseout", (event, d) => {
            if (!path.classed("active")) {
              tooltipLineChart.style("opacity", 0);
              d3.select(event.currentTarget).attr("r", 4);
            }
          })
          .on("click", () => {
            const isActive = path.classed("active");
            if (!isActive) {
              // Hide all other lines
              svgLineChart.selectAll("path").style("display", "none");

              // Show clicked line
              path.style("display", "initial").attr("stroke-width", 4);

              // Show dots of the clicked line
              svgLineChart.selectAll("circle").style("display", "none");
              svgLineChart
                .selectAll(
                  `.dot-${country.replace(/\s+/g, "-").replace(/[^\w-]/g, "")}`
                )
                .style("display", "initial");

              path.classed("active", true);

              // Update dropdown
              countryDropdown.property("value", country);

              function centerCountry(d) {
                const centroid = d3.geoCentroid(d);
                const rotate = projection.rotate();
                const newRotate = [-centroid[0], -centroid[1], rotate[2]];
                projection.rotate(newRotate);
                svgMap.selectAll(".country").attr("d", mapPath);
              }

              const selectedCountry = countrySelectorMap.node().value;
              svgMap.selectAll(".country").attr("fill", (d) => {
                const countryData = d.properties.eduExp;
                if (d.properties.name === selectedCountry) {
                  // Highlight the selected country
                  //centerCountry(d);
                  centerCountry(d);
                  return "#ffa500"; // orange color
                } else {
                  // Reset other countries to original fill color
                  return countryData === undefined
                    ? "#ccc"
                    : colorScale(countryData);
                }
              });

              updateChart(selectedCountry);
            } else {
              // Show all lines
              svgLineChart.selectAll("path").style("display", "initial");

              // Reset dots color to original
              svgLineChart.selectAll("circle").style("display", "initial");

              path.classed("active", false).attr("stroke-width", 2);
            }
          });
      });
      // Function to update the chart based on the selected country
      function updateChart(selectedCountry) {
        if (selectedCountry === "All Countries") {
          // Show all lines
          svgLineChart
            .selectAll("path")
            .style("display", "initial")
            .attr("stroke-width", 2);

          // Show all dots
          svgLineChart.selectAll("circle").style("display", "initial");

          // Remove active class from all lines
          svgLineChart.selectAll("path").classed("active", false);
        } else {
          // Hide all lines
          svgLineChart.selectAll("path").style("display", "none");

          // Hide all dots
          svgLineChart.selectAll("circle").style("display", "none");

          // Show selected country line
          const lineClass = `.line-${selectedCountry
            .replace(/\s+/g, "-")
            .replace(/[^\w-]/g, "")}`;
          svgLineChart
            .select(lineClass)
            .style("display", "initial")
            .attr("stroke-width", 4);

          // Show dots of the selected country line
          const dotClass = `.dot-${selectedCountry
            .replace(/\s+/g, "-")
            .replace(/[^\w-]/g, "")}`;
          svgLineChart.selectAll(dotClass).style("display", "initial");

          // Set the class to active
          svgLineChart.select(lineClass).classed("active", true);
        }
      }

      // Define projection for the map
      const projection = d3
        .geoOrthographic()
        //.scale(Math.min(mapWidth, mapHeight))
        .scale(200)
        .translate([mapWidth / 2, mapHeight / 1, 3])
        .clipAngle(90);

      // Define path generator for the map
      const mapPath = d3.geoPath().projection(projection);

      // Create an outer circle to represent the globe's boundary
      svgMap
        .append("circle")
        .attr("cx", mapWidth / 2)
        .attr("cy", mapHeight / 1, 3)
        .attr("r", projection.scale())
        .attr("fill", "#00072d"); // Sea color

      // Create a tooltip for the map
      const tooltipMap = d3
        .select("#map")
        .append("div")
        .attr("id", "tooltip-map")
        .style("position", "absolute")
        .style("background", "#f4f4f4")
        .style("padding", "5px")
        .style("border", "1px solid #333")
        .style("border-radius", "3px")
        .style("pointer-events", "none")
        .style("display", "none");

      // State variables
      let enlargedCountry = null;
      let isPlaying = false;
      let intervalId = null;
      let currentYearIndex = 0;
      let lastKnownValue = new Map(); // Variable to store last known value for each country

      // UI Elements
      const yearSelector = d3.select("#select-year").on("change", () => {
        if (isPlaying) {
          togglePlayStop();
        }
        updateMap();
      });

      // Toggle play/stop functionality
      function togglePlayStop() {
        isPlaying = !isPlaying;
        updatePlayStopButtonLabel();
        if (isPlaying) {
          startAutoPlay();
        } else {
          clearInterval(intervalId);
          intervalId = null;
        }
      }

      // Start autoplay from the first year and cycle through all the years
      function startAutoPlay() {
        if (!intervalId) {
          const options = yearSelector.selectAll("option");
          const numYears = options.size();

          intervalId = setInterval(() => {
            const nextYear = +options.nodes()[currentYearIndex].value;

            yearSelector.node().value = nextYear;
            updateMap();

            currentYearIndex++;
            // Check if currentYearIndex has reached the last year
            if (currentYearIndex >= numYears) {
              clearInterval(intervalId); // Stop autoplay at the last year
              intervalId = null;
              isPlaying = false;
              updatePlayStopButtonLabel(); // Update button label to "Play"
            }
          }, 250); // Change interval duration (ms) as needed
        }
      }

      // Update the play/stop button label
      function updatePlayStopButtonLabel() {
        playStopButton.text(isPlaying ? "Stop" : "Play");
      }

      const playStopButton = d3
        .select("#play-stop-button")
        .on("click", togglePlayStop);

      // Populate the dropdown with unique years from data
      const uniqueYears = [...new Set(data.map((d) => d.year))].sort(
        (a, b) => a - b
      );
      yearSelector
        .selectAll("option")
        .data(uniqueYears)
        .enter()
        .append("option")
        .attr("value", (d) => d)
        .text((d) => d);

      // Sort data by year ascending
      data.sort((a, b) => a.year - b.year);

      // Define color scale based on custom breaks for map
      const colorScale = d3
        .scaleThreshold()
        .domain([0, 50, 100, 200, 500, 1000, 2000, 3000, 5000, 10000])
        .range([
          "#f7fbff",
          "#deebf7",
          "#c6dbef",
          "#9ecae1",
          "#6baed6",
          "#4292c6",
          "#2171b5",
          "#08519c",
          "#084594",
          "#08306b",
        ]); // color palette

      // Populate country dropdown for map
      const countrySelectorMap = d3
        .select("#select-country")
        .on("change", () => {
          function centerCountry(d) {
            const centroid = d3.geoCentroid(d);
            const rotate = projection.rotate();
            const newRotate = [-centroid[0], -centroid[1], rotate[2]];
            projection.rotate(newRotate);
            svgMap.selectAll(".country").attr("d", mapPath);
          }

          const selectedCountry = countrySelectorMap.node().value;
          svgMap.selectAll(".country").attr("fill", (d) => {
            const countryData = d.properties.eduExp;
            if (d.properties.name === selectedCountry) {
              // Highlight the selected country
              //centerCountry(d);
              centerCountry(d);
              return "#ffa500"; // orange color
            } else {
              // Reset other countries to original fill color
              return countryData === undefined
                ? "#ccc"
                : colorScale(countryData);
            }
          });

          updateChart(selectedCountry);
        });

      // Get unique countries from data
      const uniqueCountriesMap = [...new Set(data.map((d) => d.Entity))];

      // Sort the countries in ascending order
      uniqueCountriesMap.sort((a, b) => a.localeCompare(b));

      // Add "All Countries" at the beginning
      uniqueCountriesMap.unshift("All Countries");

      // Populate the dropdown with unique countries
      countrySelectorMap
        .selectAll("option")
        .data(uniqueCountriesMap)
        .enter()
        .append("option")
        .attr("value", (d) => d)
        .text((d) => d);

      // Populate country dropdown for line chart
      const countryDropdownLineChart = d3
        .select("#select-country-line-chart")
        .on("change", () => {
          const selectedCountry = countryDropdownLineChart.node().value;
          updateChart(selectedCountry);
        });

      // Populate the dropdown with unique countries from data for line chart
      const uniqueCountriesLineChart = [...new Set(data.map((d) => d.Entity))];
      countryDropdownLineChart
        .selectAll("option")
        .data(uniqueCountriesLineChart)
        .enter()
        .append("option")
        .attr("value", (d) => d)
        .text((d) => d);

      // Initialize map and line chart with default country
      updateMap();

      updateChart("All Countries");

      // Function to update the map based on selected year
      function updateMap() {
        const selectedYear = +yearSelector.node().value;

        // Find the index of the selected year in the dropdown options
        const options = yearSelector.selectAll("option");
        currentYearIndex = options
          .nodes()
          .findIndex((option) => +option.value === selectedYear);

        // Filter data for the selected year and all previous years
        const filteredData = data.filter((d) => d.year <= selectedYear);

        // Update last known values only if autoplay is starting a new cycle or there are values before the selected year
        if (currentYearIndex === 0 || filteredData.length > 0) {
          lastKnownValue.clear(); // Clear existing last known values
          filteredData.forEach((d) => {
            lastKnownValue.set(d.Entity, d["EDU Exp. Per Person Absolute"]);
          });
        }

        // Load GeoJSON data
        const countries = topojson.feature(
          world,
          world.objects.countries
        ).features;

        // Merge filtered CSV data with GeoJSON data for map
        const dataMap = new Map(
          filteredData.map((d) => [
            d["Entity"],
            d["EDU Exp. Per Person Absolute"],
          ])
        );

        countries.forEach((country) => {
          const countryName = country.properties.name;
          // Use the filtered data for the selected year and show last known value otherwise
          country.properties.eduExp = dataMap.has(countryName)
            ? dataMap.get(countryName)
            : lastKnownValue.has(countryName)
            ? lastKnownValue.get(countryName)
            : undefined; ////////////////////////////////////////////////////////////////////////////////////////////////////////////
        });

        // Draw the countries on map
        const countryPaths = svgMap
          .selectAll(".country")
          .data(countries)
          .join("path")
          .attr("class", "country")
          .attr("d", mapPath)
          .attr("fill", (d) => {
            const countryData = d.properties.eduExp;
            // Set the fill color to grey if data is undefined
            if (countryData === undefined) {
              return "#ccc";
            }
            return colorScale(countryData);
          })
          .attr("stroke", "#333")
          .attr("stroke-width", 0.5)
          .on("mouseover", (event, d) => {
            if (!enlargedCountry) {
              // Only show tooltip if no country is enlarged
              showTooltip(event, d);
            }
          })
          .on("mouseout", () => {
            if (!enlargedCountry) {
              // Only hide tooltip if no country is enlarged
              hideTooltip();
            }
          })
          .on("mousemove", (event) => {
            if (!enlargedCountry) {
              // Update tooltip position if no country is enlarged
              tooltipMap
                .style("left", event.pageX + 5 + "px")
                .style("top", event.pageY - 28 + "px");
            }
          })
          .on("click", function (event, d) {
            if (enlargedCountry === this) {
              console.log(this);
              // Reset the country to its original size
              d3.select(this)
                .transition()
                .duration(200)
                .attr("transform", "scale(1)");
              enlargedCountry = null;
              tooltipMap.style("display", "none"); // Hide tooltip when unclicking
            } else {
              // Reset all countries
              countryPaths
                .transition()
                .duration(200)
                .attr("transform", "scale(1)");

              // Update the state
              enlargedCountry = this;

              // Display country name and EDU Exp. Per Person Absolute in tooltip
              showTooltip(event, d);
            }

            // Center the clicked country
            centerCountry(d);

            // Update the dropdown selection to match the clicked country
            countrySelectorMap.node().value = d.properties.name;
            countrySelectorMap.dispatch("change"); // Trigger change event on the dropdown
          });

        // Create legend
        createLegend(colorScale);

        // Enable user-controlled rotation
        enableDragRotation();

        // Auto-play functionality
        if (isPlaying) {
          startAutoPlay();
        }

        function centerCountry(d) {
          const centroid = d3.geoCentroid(d);
          const rotate = projection.rotate();
          const newRotate = [-centroid[0], -centroid[1], rotate[2]];
          projection.rotate(newRotate);
          svgMap.selectAll(".country").attr("d", mapPath);
        }

        function createLegend(colorScale) {
          const legendContainer = d3.select("#legend");

          // Clear existing legend
          legendContainer.html("");

          // Define custom legend ticks
          const legendTicks = [
            0, 50, 100, 200, 500, 1000, 2000, 3000, 5000, 10000,
          ];

          // Create legend item groups
          const legend = legendContainer
            .append("svg")
            .attr("width", legendContainerWidth) // Adjust width as needed
            .attr("height", 20)
            .selectAll(".legend-item")
            .data(legendTicks)
            .enter()
            .append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(${i * 50}, 0)`); // Adjust spacing as needed

          // Add colored rectangles to legend
          legend
            .append("rect")
            .attr("width", legendContainerWidth / legendTicks.length)
            .attr("height", 5)
            .style("fill", (d) => colorScale(d));

          // Add legend labels
          legend
            .append("text")
            .attr("class", "legend-label")
            .attr("x", (legendContainerWidth / legendTicks.length - 5) / 2) // Adjust x position to center the text
            .attr("y", 15) // Position text below the rectangles
            .style("text-anchor", "middle")
            .style("font-size", "10px") // Adjust font size as needed
            .text((d) => {
              if (d === 10000) {
                return "10000+";
              } else {
                return d;
              }
            });
        }

        // Function to show tooltip
        function showTooltip(event, d) {
          const [x, y] = d3.pointer(event);
          tooltipMap
            .style("display", "block")
            .style("left", x + "px")
            .style("top", y + "px")
            .html(
              `<strong>${d.properties.name}</strong><br>
                    ${
                      d.properties.eduExp !== undefined
                        ? `EDU Exp. Per Person: ${d.properties.eduExp.toFixed(
                            2
                          )}`
                        : "Data not available"
                    }`
            );
        }

        // Enable user-controlled rotation
        function enableDragRotation() {
          const drag = d3.drag().on("drag", (event) => {
            const rotate = projection.rotate();
            const k = 0.5; // Sensitivity factor
            projection.rotate([
              rotate[0] + event.dx * k,
              rotate[1] - event.dy * k,
            ]);
            svgMap.selectAll(".country").attr("d", mapPath);
          });

          svgMap.call(drag);
        }

        function showTooltip(event, d) {
          tooltipMap
            .style("display", "block")
            .html(
              `${d.properties.name}: ${
                d.properties.eduExp !== undefined
                  ? d.properties.eduExp
                  : "No data"
              }`
            )
            .style("left", event.pageX + 5 + "px")
            .style("top", event.pageY - 28 + "px");
        }

        // Function to hide tooltip
        function hideTooltip() {
          tooltipMap.style("display", "none");
        }
        /*
        // Function to enlarge country
        function enlargeCountry(d) {
          enlargedCountry = d;

          // Reset zoom to show entire map
          svgMap
            .transition()
            .duration(750)
            .call(
              zoom.transform,
              d3.zoomIdentity,
              d3.pointer(event, svgMap.node())
            );
        }
            */
      }

      // Set initial state
      const initialCountry = "All Countries";
      updateChart(initialCountry);

      // Add gridlines to the line chart
      const xGridlines = d3
        .axisBottom(xScale)
        .tickSize(-chartHeight)
        .tickFormat("")
        .ticks(5);

      const yGridlines = d3
        .axisLeft(yScale)
        .tickSize(-chartWidth)
        .tickFormat("")
        .ticks(5);

      svgLineChart
        .append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(xGridlines);

      svgLineChart.append("g").attr("class", "grid").call(yGridlines);

      // Add labels to the axes
      svgLineChart
        .append("text")
        .attr("class", "x axis-label")
        .attr("x", chartWidth)
        .attr("y", chartHeight + margin.bottom - 5)
        .attr("text-anchor", "middle")
        .text("Year");

      svgLineChart
        .append("text")
        .attr("class", "y axis-label")
        .attr("x", -chartHeight)
        .attr("y", -margin.left + 15)
        //.attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .text("Education Cost Per Person (US$)");
      /*
      let zoomed = d3
        .zoom()
        .scaleExtent([0.5, 10])
        .extent([
          [0, 0],
          [width, height],
        ])
        .on("zoom", NeuerChart);
*/

      function zoomed({ transform }, d) {
        // Check if transform is defined
        if (!transform) return;

        const scale = transform.k;
        const [x, y] = [mapWidth / 2, mapHeight / 2];

        // Apply the zoom transformation centered around [x, y]
        svgMap.attr(
          "transform",
          `translate(${x},${y}) scale(${scale}) translate(${-x},${-y})`
        );
      }
    })

    .catch((error) => {
      console.error("Error loading data:", error);
    });
});
