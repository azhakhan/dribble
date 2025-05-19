import { registerAllModules } from "handsontable/registry";
import { HotTable } from "@handsontable/react-wrapper";

registerAllModules();

const data = [
  [
    false,
    "Tagcat",
    "United Kingdom",
    "Classic Vest",
    "11/10/2020",
    "01-2331942",
    true,
    "172",
    2,
    2,
  ],
  [
    true,
    "Zoomzone",
    "Indonesia",
    "Cycling Cap",
    "03/05/2020",
    "88-2768633",
    true,
    "188",
    6,
    2,
  ],
  [
    true,
    "Meeveo",
    "United States",
    "Full-Finger Gloves",
    "27/03/2020",
    "51-6775945",
    true,
    "162",
    1,
    3,
  ],
  [
    false,
    "Buzzdog",
    "Philippines",
    "HL Mountain Frame",
    "29/08/2020",
    "44-4028109",
    true,
    "133",
    7,
    1,
  ],
  [
    true,
    "Katz",
    "India",
    "Half-Finger Gloves",
    "02/10/2020",
    "08-2758492",
    true,
    "87",
    1,
    3,
  ],
  [
    false,
    "Jaxbean",
    "China",
    "HL Road Frame",
    "28/09/2020",
    "84-3557705",
    false,
    "26",
    8,
    1,
  ],
  [
    false,
    "Wikido",
    "Brazil",
    "HL Touring Frame",
    "24/06/2020",
    "20-9397637",
    false,
    "110",
    4,
    1,
  ],
  [
    false,
    "Browsedrive",
    "United States",
    "LL Mountain Frame",
    "13/03/2020",
    "36-0079556",
    true,
    "50",
    4,
    4,
  ],
  [
    false,
    "Twinder",
    "United Kingdom",
    "LL Road Frame",
    "06/04/2020",
    "41-1489542",
    false,
    "160",
    6,
    1,
  ],
  [
    false,
    "Jetwire",
    "China",
    "LL Touring Frame",
    "01/02/2020",
    "37-1531629",
    true,
    "30",
    8,
    5,
  ],
  [
    false,
    "Chatterpoint",
    "China",
    "Long-Sleeve Logo Jersey",
    "14/07/2020",
    "25-5083429",
    true,
    "39",
    7,
    2,
  ],
  [
    false,
    "Twinder",
    "Egypt",
    "Men's Bib-Shorts",
    "31/08/2020",
    "04-4281278",
    false,
    "96",
    6,
    1,
  ],
  [
    false,
    "Midel",
    "United States",
    "Men's Sports Shorts",
    "27/06/2020",
    "55-1711908",
    true,
    "108",
    10,
    3,
  ],
];

export const EditableTable = () => {
  return (
    <div className="ht-theme-main-dark-auto">
      <HotTable
        data={data}
        columns={[
          { data: 1, type: "text" },
          { data: 3, type: "text" },
          {
            data: 4,
            type: "date",
            allowInvalid: false,
          },
          {
            data: 6,
            type: "checkbox",
            className: "htCenter",
            headerClassName: "htCenter",
          },
          {
            data: 7,
            type: "numeric",
            headerClassName: "htRight",
          },
          { data: 5, type: "text" },
          { data: 2, type: "text" },
        ]}
        colHeaders={[
          "Company name",
          "Name",
          "Sell date",
          "In stock",
          "Qty",
          "Order ID",
          "Country",
        ]}
        rowHeaders={true}
        height="auto"
        autoWrapRow={true}
        autoWrapCol={true}
        licenseKey="non-commercial-and-evaluation" // for non-commercial use only
      />
    </div>
  );
};
