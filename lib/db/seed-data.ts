/**
 * Demo data for a fictional retailer, Akwaaba Mall, at the scale of Ghana's
 * big general-merchandise stores: five stores and a central warehouse, a
 * catalogue spanning groceries to furniture, local and imported suppliers.
 * Places are real; the company, people and suppliers are made up.
 */

import type { Unit } from "./schema.ts";

export const COMPANY_NAME = "Akwaaba Mall";

export const BRANCHES = [
  {
    address: "Spintex Road, near Coca-Cola Roundabout",
    city: "Accra",
    id: "SPX",
    kind: "store",
    name: "Spintex",
    region: "Greater Accra",
  },
  {
    address: "Weija Junction, Winneba Road",
    city: "Accra",
    id: "WJA",
    kind: "store",
    name: "Weija",
    region: "Greater Accra",
  },
  {
    address: "Lebanon Zone 2, Ashaiman",
    city: "Ashaiman",
    id: "ASH",
    kind: "store",
    name: "Ashaiman",
    region: "Greater Accra",
  },
  {
    address: "Amasaman, Nsawam Road",
    city: "Accra",
    id: "AMS",
    kind: "store",
    name: "Amasaman",
    region: "Greater Accra",
  },
  {
    address: "Ahinsan, Lake Road",
    city: "Kumasi",
    id: "KSI",
    kind: "store",
    name: "Kumasi (Ahinsan)",
    region: "Ashanti",
  },
  {
    address: "Free Zone Enclave, Tema",
    city: "Tema",
    id: "TMA",
    kind: "warehouse",
    name: "Tema Distribution Centre",
    region: "Greater Accra",
  },
] as const;

export const SUPPLIERS = [
  {
    contactName: "Kwame Owusu",
    country: "GH",
    email: "orders@tema-foods.example",
    leadTimeDays: 3,
    name: "Tema Foods Distribution",
    phone: "+233 30 220 1145",
  },
  {
    contactName: "Abena Darko",
    country: "GH",
    email: "sales@volta-beverages.example",
    leadTimeDays: 4,
    name: "Volta Beverages Ltd",
    phone: "+233 30 291 8820",
  },
  {
    contactName: "Yaw Asamoah",
    country: "GH",
    email: "trade@kasoa-plastics.example",
    leadTimeDays: 5,
    name: "Kasoa Plastics Works",
    phone: "+233 24 455 1902",
  },
  {
    contactName: "Esi Quaye",
    country: "GH",
    email: "info@adinkra-home.example",
    leadTimeDays: 7,
    name: "Adinkra Home & Linen",
    phone: "+233 55 310 7781",
  },
  {
    contactName: "Li Wei",
    country: "CN",
    email: "export@yiwu-homeware.example",
    leadTimeDays: 45,
    name: "Yiwu Bright Homeware Co.",
    phone: "+86 579 8555 0142",
  },
  {
    contactName: "Chen Jing",
    country: "CN",
    email: "sales@shenzhen-volt.example",
    leadTimeDays: 40,
    name: "Shenzhen Voltline Electronics",
    phone: "+86 755 2650 8810",
  },
  {
    contactName: "Zhang Min",
    country: "CN",
    email: "trade@guangzhou-toys.example",
    leadTimeDays: 50,
    name: "Guangzhou Happy Kids Toys",
    phone: "+86 20 3826 4471",
  },
  {
    contactName: "Wang Fang",
    country: "CN",
    email: "orders@foshan-furniture.example",
    leadTimeDays: 60,
    name: "Foshan Comfort Furniture",
    phone: "+86 757 8231 0093",
  },
  {
    contactName: "Liu Yang",
    country: "CN",
    email: "sales@jinjiang-footwear.example",
    leadTimeDays: 45,
    name: "Jinjiang Stride Footwear",
    phone: "+86 595 8566 7710",
  },
  {
    contactName: "Akosua Frimpong",
    country: "GH",
    email: "orders@shea-glow.example",
    leadTimeDays: 5,
    name: "Shea Glow Cosmetics",
    phone: "+233 20 818 4426",
  },
  {
    contactName: "Nana Adjei",
    country: "GH",
    email: "sales@accra-stationers.example",
    leadTimeDays: 4,
    name: "Accra Stationers",
    phone: "+233 30 266 0035",
  },
  {
    contactName: "Musa Ibrahim",
    country: "NG",
    email: "export@lagos-textiles.example",
    leadTimeDays: 21,
    name: "Lagos Textile Mills",
    phone: "+234 1 271 3390",
  },
] as const;

export type SupplierName = (typeof SUPPLIERS)[number]["name"];

interface Line {
  /** Product name; "{v}" is replaced by each variant. */
  readonly name: string;
  readonly variants?: readonly string[];
  /** Shelf price in cedis for the first variant; later variants step up. */
  readonly price: number;
  /** Price multiplier per variant step. */
  readonly step?: number;
  readonly unit?: Unit;
  readonly supplier: SupplierName;
  readonly reorder: number;
  /** Imported goods carry Chinese GS1 prefixes, local goods Ghana's (603). */
  readonly imported?: boolean;
}

interface CategorySeed {
  readonly name: string;
  readonly department: string;
  /** SKU prefix. */
  readonly code: string;
  readonly lines: readonly Line[];
}

const FOODS = "Tema Foods Distribution";
const DRINKS = "Volta Beverages Ltd";
const PLASTICS = "Kasoa Plastics Works";
const LINEN = "Adinkra Home & Linen";
const HOMEWARE = "Yiwu Bright Homeware Co.";
const VOLT = "Shenzhen Voltline Electronics";
const TOYS = "Guangzhou Happy Kids Toys";
const FURNITURE = "Foshan Comfort Furniture";
const SHOES = "Jinjiang Stride Footwear";
const SHEA = "Shea Glow Cosmetics";
const STATIONERS = "Accra Stationers";
const TEXTILES = "Lagos Textile Mills";

export const CATALOGUE: readonly CategorySeed[] = [
  {
    code: "GRN",
    department: "Groceries",
    lines: [
      {
        name: "Long grain perfumed rice {v}",
        price: 48,
        reorder: 60,
        step: 1.9,
        supplier: FOODS,
        variants: ["1 kg", "5 kg", "25 kg"],
      },
      {
        name: "Jasmine rice {v}",
        price: 165,
        reorder: 40,
        step: 1.85,
        supplier: FOODS,
        variants: ["5 kg", "10 kg"],
      },
      { name: "Spaghetti 500 g", price: 14, reorder: 120, supplier: FOODS },
      {
        name: "Gari, white, {v}",
        price: 12,
        reorder: 80,
        step: 1.8,
        supplier: FOODS,
        variants: ["1 kg", "2 kg"],
      },
      { name: "Oats, rolled, 500 g", price: 32, reorder: 50, supplier: FOODS },
      { name: "Corn flakes 375 g", price: 46, reorder: 40, supplier: FOODS },
    ],
    name: "Rice, pasta & grains",
  },
  {
    code: "PNT",
    department: "Groceries",
    lines: [
      {
        name: "Tomato paste tin {v}",
        price: 6,
        reorder: 200,
        step: 2.4,
        supplier: FOODS,
        variants: ["70 g", "210 g", "400 g"],
      },
      {
        name: "Sardines in tomato sauce 125 g",
        price: 13,
        reorder: 150,
        supplier: FOODS,
      },
      { name: "Corned beef 340 g", price: 42, reorder: 60, supplier: FOODS },
      { name: "Baked beans 415 g", price: 18, reorder: 90, supplier: FOODS },
      {
        name: "Evaporated milk 160 g",
        price: 9,
        reorder: 240,
        supplier: FOODS,
      },
      {
        name: "Powdered milk tin 400 g",
        price: 68,
        reorder: 60,
        supplier: FOODS,
      },
      {
        name: "Chocolate drink powder {v}",
        price: 38,
        reorder: 50,
        step: 1.9,
        supplier: FOODS,
        variants: ["400 g", "900 g"],
      },
    ],
    name: "Tins & packaged food",
  },
  {
    code: "OIL",
    department: "Groceries",
    lines: [
      {
        name: "Vegetable oil {v}",
        price: 38,
        reorder: 80,
        step: 2.8,
        supplier: FOODS,
        unit: "litre",
        variants: ["1 L", "3 L", "5 L"],
      },
      {
        name: "Palm oil, red, 1 L",
        price: 45,
        reorder: 40,
        supplier: FOODS,
        unit: "litre",
      },
      { name: "Iodised salt 500 g", price: 5, reorder: 150, supplier: FOODS },
      {
        name: "Stock cubes, box of 100",
        price: 52,
        reorder: 70,
        supplier: FOODS,
      },
      { name: "Sugar cubes 500 g", price: 22, reorder: 80, supplier: FOODS },
      {
        name: "Ground pepper mix 100 g",
        price: 15,
        reorder: 60,
        supplier: FOODS,
      },
    ],
    name: "Oils, sugar & seasoning",
  },
  {
    code: "BEV",
    department: "Groceries",
    lines: [
      {
        name: "Bottled water {v}",
        price: 4,
        reorder: 300,
        step: 1.6,
        supplier: DRINKS,
        variants: ["500 ml", "1.5 L"],
      },
      {
        name: "Sachet water, bag of 30",
        price: 12,
        reorder: 120,
        supplier: DRINKS,
        unit: "pack",
      },
      {
        name: "Malt drink 330 ml can",
        price: 10,
        reorder: 240,
        supplier: DRINKS,
      },
      { name: "Cola 1.5 L", price: 15, reorder: 120, supplier: DRINKS },
      { name: "Orange juice 1 L", price: 28, reorder: 60, supplier: DRINKS },
      {
        name: "Energy drink 250 ml",
        price: 11,
        reorder: 150,
        supplier: DRINKS,
      },
      { name: "Black tea, 50 bags", price: 24, reorder: 60, supplier: FOODS },
      { name: "Instant coffee 200 g", price: 75, reorder: 30, supplier: FOODS },
    ],
    name: "Drinks",
  },
  {
    code: "CKW",
    department: "Home & Kitchen",
    lines: [
      {
        name: "Non-stick frying pan {v}",
        imported: true,
        price: 85,
        reorder: 15,
        step: 1.25,
        supplier: HOMEWARE,
        variants: ["20 cm", "24 cm", "28 cm"],
      },
      {
        name: "Aluminium cooking pot {v}",
        imported: true,
        price: 120,
        reorder: 10,
        step: 1.35,
        supplier: HOMEWARE,
        variants: ["5 L", "10 L", "20 L"],
      },
      {
        name: "Pressure cooker 7 L",
        imported: true,
        price: 380,
        reorder: 6,
        supplier: HOMEWARE,
      },
      {
        name: "Stainless steel cutlery set, 24 pieces",
        imported: true,
        price: 145,
        reorder: 10,
        supplier: HOMEWARE,
      },
      {
        name: "Ceramic dinner plates, set of 6",
        imported: true,
        price: 110,
        reorder: 12,
        supplier: HOMEWARE,
      },
      {
        name: "Glass tumblers, set of 6",
        imported: true,
        price: 65,
        reorder: 15,
        supplier: HOMEWARE,
      },
      {
        name: "Wooden asanka and tapoli set",
        price: 55,
        reorder: 10,
        supplier: LINEN,
      },
      {
        name: "Vacuum flask {v}",
        imported: true,
        price: 70,
        reorder: 12,
        step: 1.4,
        supplier: HOMEWARE,
        variants: ["1 L", "2 L"],
      },
    ],
    name: "Cookware & tableware",
  },
  {
    code: "APL",
    department: "Home & Kitchen",
    lines: [
      {
        name: "Electric kettle 1.7 L",
        imported: true,
        price: 165,
        reorder: 10,
        supplier: VOLT,
      },
      {
        name: "Blender with grinder, 1.5 L",
        imported: true,
        price: 420,
        reorder: 8,
        supplier: VOLT,
      },
      {
        name: "Rice cooker {v}",
        imported: true,
        price: 360,
        reorder: 6,
        step: 1.3,
        supplier: VOLT,
        variants: ["1.8 L", "2.8 L"],
      },
      {
        name: "Microwave oven 20 L",
        imported: true,
        price: 1250,
        reorder: 4,
        supplier: VOLT,
      },
      {
        name: "Two-burner gas stove",
        imported: true,
        price: 480,
        reorder: 5,
        supplier: HOMEWARE,
      },
      {
        name: "Toaster, 2 slice",
        imported: true,
        price: 240,
        reorder: 6,
        supplier: VOLT,
      },
      {
        name: "Chest freezer 200 L",
        imported: true,
        price: 4800,
        reorder: 2,
        supplier: VOLT,
      },
    ],
    name: "Kitchen appliances",
  },
  {
    code: "PLS",
    department: "Home & Kitchen",
    lines: [
      {
        name: "Plastic bucket with lid {v}",
        price: 22,
        reorder: 30,
        step: 1.45,
        supplier: PLASTICS,
        variants: ["10 L", "15 L", "20 L"],
      },
      {
        name: "Storage box with lid {v}",
        price: 45,
        reorder: 20,
        step: 1.6,
        supplier: PLASTICS,
        variants: ["20 L", "45 L", "80 L"],
      },
      {
        name: "Plastic chair, white",
        price: 75,
        reorder: 40,
        supplier: PLASTICS,
      },
      {
        name: "Food containers, set of 5",
        imported: true,
        price: 58,
        reorder: 20,
        supplier: HOMEWARE,
      },
      { name: "Laundry basket", price: 48, reorder: 15, supplier: PLASTICS },
      {
        name: "Water jerrycan 25 L",
        price: 38,
        reorder: 25,
        supplier: PLASTICS,
      },
    ],
    name: "Plastics & storage",
  },
  {
    code: "CLN",
    department: "Home & Kitchen",
    lines: [
      {
        name: "Laundry powder {v}",
        price: 18,
        reorder: 100,
        step: 2.6,
        supplier: FOODS,
        variants: ["500 g", "2 kg", "5 kg"],
      },
      {
        name: "Bar soap, pack of 3",
        price: 15,
        reorder: 120,
        supplier: SHEA,
        unit: "pack",
      },
      {
        name: "Dishwashing liquid 750 ml",
        price: 22,
        reorder: 80,
        supplier: FOODS,
      },
      { name: "Bleach 1 L", price: 16, reorder: 60, supplier: FOODS },
      {
        name: "Toilet roll, pack of 10",
        price: 42,
        reorder: 90,
        supplier: FOODS,
        unit: "pack",
      },
      {
        name: "Insecticide spray 600 ml",
        price: 38,
        reorder: 50,
        supplier: FOODS,
      },
      {
        name: "Broom and dustpan set",
        imported: true,
        price: 35,
        reorder: 20,
        supplier: HOMEWARE,
      },
    ],
    name: "Cleaning & laundry",
  },
  {
    code: "TVA",
    department: "Electronics",
    lines: [
      {
        name: "LED television {v}",
        imported: true,
        price: 1850,
        reorder: 4,
        step: 1.55,
        supplier: VOLT,
        variants: ["32 inch", "43 inch", "55 inch", "65 inch"],
      },
      {
        name: "Bluetooth speaker, portable",
        imported: true,
        price: 280,
        reorder: 10,
        supplier: VOLT,
      },
      {
        name: "Home theatre system 5.1",
        imported: true,
        price: 1650,
        reorder: 3,
        supplier: VOLT,
      },
      {
        name: "Satellite decoder",
        imported: true,
        price: 320,
        reorder: 8,
        supplier: VOLT,
      },
    ],
    name: "TV & audio",
  },
  {
    code: "PHN",
    department: "Electronics",
    lines: [
      {
        name: "Smartphone, 6.5 inch, {v}",
        imported: true,
        price: 1450,
        reorder: 5,
        step: 1.4,
        supplier: VOLT,
        variants: ["64 GB", "128 GB", "256 GB"],
      },
      {
        name: "Power bank {v}",
        imported: true,
        price: 120,
        reorder: 20,
        step: 1.5,
        supplier: VOLT,
        variants: ["10,000 mAh", "20,000 mAh"],
      },
      {
        name: "USB-C charging cable 1 m",
        imported: true,
        price: 25,
        reorder: 60,
        supplier: VOLT,
      },
      {
        name: "Fast wall charger 20 W",
        imported: true,
        price: 65,
        reorder: 30,
        supplier: VOLT,
      },
      {
        name: "Wireless earbuds",
        imported: true,
        price: 190,
        reorder: 15,
        supplier: VOLT,
      },
      {
        name: "Phone case, assorted",
        imported: true,
        price: 30,
        reorder: 40,
        supplier: VOLT,
      },
    ],
    name: "Phones & accessories",
  },
  {
    code: "SAP",
    department: "Electronics",
    lines: [
      {
        name: "Standing fan {v}",
        imported: true,
        price: 290,
        reorder: 10,
        step: 1.3,
        supplier: VOLT,
        variants: ["16 inch", "18 inch"],
      },
      {
        name: "Rechargeable fan 14 inch",
        imported: true,
        price: 420,
        reorder: 8,
        supplier: VOLT,
      },
      {
        name: "Dry iron",
        imported: true,
        price: 110,
        reorder: 12,
        supplier: VOLT,
      },
      {
        name: "Rechargeable lantern",
        imported: true,
        price: 95,
        reorder: 20,
        supplier: VOLT,
      },
      {
        name: "Extension board, 4 way",
        imported: true,
        price: 70,
        reorder: 25,
        supplier: VOLT,
      },
      {
        name: "Voltage stabiliser 1000 VA",
        imported: true,
        price: 380,
        reorder: 6,
        supplier: VOLT,
      },
      {
        name: "LED bulb 12 W, pack of 3",
        imported: true,
        price: 45,
        reorder: 40,
        supplier: VOLT,
        unit: "pack",
      },
    ],
    name: "Fans, lighting & power",
  },
  {
    code: "BTY",
    department: "Health & Beauty",
    lines: [
      {
        name: "Shea butter body cream {v}",
        price: 28,
        reorder: 40,
        step: 1.7,
        supplier: SHEA,
        variants: ["200 ml", "500 ml"],
      },
      {
        name: "Black soap, natural, 250 g",
        price: 20,
        reorder: 50,
        supplier: SHEA,
      },
      { name: "Hair relaxer kit", price: 55, reorder: 25, supplier: SHEA },
      {
        name: "Petroleum jelly {v}",
        price: 12,
        reorder: 60,
        step: 1.9,
        supplier: SHEA,
        variants: ["100 ml", "250 ml"],
      },
      {
        name: "Roll-on deodorant 50 ml",
        price: 26,
        reorder: 50,
        supplier: SHEA,
      },
      { name: "Toothpaste 140 g", price: 17, reorder: 100, supplier: SHEA },
      {
        name: "Toothbrush, pack of 2",
        price: 12,
        reorder: 80,
        supplier: SHEA,
        unit: "pack",
      },
    ],
    name: "Skin, hair & toiletries",
  },
  {
    code: "BBY",
    department: "Kids & Baby",
    lines: [
      {
        name: "Baby diapers, size {v}, pack of 40",
        price: 95,
        reorder: 40,
        step: 1.08,
        supplier: FOODS,
        unit: "pack",
        variants: ["2", "3", "4", "5"],
      },
      {
        name: "Baby wipes, 80 sheets",
        price: 22,
        reorder: 60,
        supplier: FOODS,
        unit: "pack",
      },
      {
        name: "Infant formula 400 g",
        price: 110,
        reorder: 30,
        supplier: FOODS,
      },
      {
        name: "Baby feeding bottle 250 ml",
        imported: true,
        price: 35,
        reorder: 25,
        supplier: TOYS,
      },
      {
        name: "Baby walker",
        imported: true,
        price: 320,
        reorder: 4,
        supplier: TOYS,
      },
    ],
    name: "Baby care",
  },
  {
    code: "TOY",
    department: "Kids & Baby",
    lines: [
      {
        name: "Remote control car",
        imported: true,
        price: 180,
        reorder: 8,
        supplier: TOYS,
      },
      {
        name: "Building blocks, 300 pieces",
        imported: true,
        price: 140,
        reorder: 10,
        supplier: TOYS,
      },
      {
        name: "Fashion doll with accessories",
        imported: true,
        price: 95,
        reorder: 12,
        supplier: TOYS,
      },
      {
        name: "Children's bicycle {v}",
        imported: true,
        price: 650,
        reorder: 3,
        step: 1.25,
        supplier: TOYS,
        variants: ["12 inch", "16 inch", "20 inch"],
      },
      {
        name: "Football, size 5",
        imported: true,
        price: 85,
        reorder: 15,
        supplier: TOYS,
      },
      { name: "Oware board, carved", price: 150, reorder: 5, supplier: LINEN },
    ],
    name: "Toys & games",
  },
  {
    code: "FTW",
    department: "Fashion",
    lines: [
      {
        name: "Men's slides, size {v}",
        imported: true,
        price: 45,
        reorder: 10,
        step: 1,
        supplier: SHOES,
        unit: "pair",
        variants: ["41", "42", "43", "44", "45"],
      },
      {
        name: "Women's sandals, size {v}",
        imported: true,
        price: 65,
        reorder: 8,
        step: 1,
        supplier: SHOES,
        unit: "pair",
        variants: ["37", "38", "39", "40"],
      },
      {
        name: "Children's school shoes, size {v}",
        imported: true,
        price: 95,
        reorder: 8,
        step: 1.05,
        supplier: SHOES,
        unit: "pair",
        variants: ["30", "32", "34", "36"],
      },
      {
        name: "Canvas sneakers, size {v}",
        imported: true,
        price: 120,
        reorder: 6,
        step: 1,
        supplier: SHOES,
        unit: "pair",
        variants: ["40", "42", "44"],
      },
    ],
    name: "Footwear",
  },
  {
    code: "BAG",
    department: "Fashion",
    lines: [
      {
        name: "School backpack",
        imported: true,
        price: 110,
        reorder: 20,
        supplier: HOMEWARE,
      },
      {
        name: "Travel suitcase {v}",
        imported: true,
        price: 380,
        reorder: 4,
        step: 1.3,
        supplier: HOMEWARE,
        variants: ["20 inch", "24 inch", "28 inch"],
      },
      {
        name: "African print fabric, 6 yards",
        price: 180,
        reorder: 15,
        supplier: TEXTILES,
      },
      {
        name: "Men's cotton T-shirt, assorted",
        imported: true,
        price: 55,
        reorder: 30,
        supplier: TEXTILES,
      },
    ],
    name: "Bags, luggage & clothing",
  },
  {
    code: "FUR",
    department: "Furniture & Bedding",
    lines: [
      {
        name: "Foam mattress {v}",
        price: 650,
        reorder: 4,
        step: 1.35,
        supplier: LINEN,
        variants: ["single", "double", "queen"],
      },
      {
        name: "Bed sheet set {v}",
        price: 140,
        reorder: 10,
        step: 1.25,
        supplier: LINEN,
        variants: ["single", "double", "queen"],
      },
      {
        name: "Pillow, pair",
        price: 85,
        reorder: 15,
        supplier: LINEN,
        unit: "pair",
      },
      {
        name: "Office chair, mesh back",
        imported: true,
        price: 890,
        reorder: 3,
        supplier: FURNITURE,
      },
      {
        name: "Plastic wardrobe, 3 door",
        imported: true,
        price: 720,
        reorder: 3,
        supplier: FURNITURE,
      },
      {
        name: "Coffee table, glass top",
        imported: true,
        price: 980,
        reorder: 2,
        supplier: FURNITURE,
      },
      {
        name: "Mosquito net, treated, double",
        price: 75,
        reorder: 20,
        supplier: LINEN,
      },
    ],
    name: "Furniture & bedding",
  },
  {
    code: "STN",
    department: "Stationery",
    lines: [
      {
        name: "Exercise book, 80 pages, pack of 10",
        price: 35,
        reorder: 60,
        supplier: STATIONERS,
        unit: "pack",
      },
      {
        name: "Ballpoint pens, blue, box of 50",
        price: 48,
        reorder: 30,
        supplier: STATIONERS,
      },
      {
        name: "A4 printing paper, ream",
        price: 85,
        reorder: 30,
        supplier: STATIONERS,
      },
      {
        name: "Mathematical set",
        imported: true,
        price: 25,
        reorder: 40,
        supplier: STATIONERS,
      },
      {
        name: "Scientific calculator",
        imported: true,
        price: 140,
        reorder: 15,
        supplier: VOLT,
      },
    ],
    name: "School & office",
  },
];

export const STAFF = [
  {
    branchId: null,
    email: "efua.asante@akwaaba.example",
    name: "Efua Asante",
    role: "admin",
  },
  {
    branchId: null,
    email: "daniel.ofori@akwaaba.example",
    name: "Daniel Ofori",
    role: "admin",
  },
  {
    branchId: "SPX",
    email: "ama.mensah@akwaaba.example",
    name: "Ama Mensah",
    role: "manager",
  },
  {
    branchId: "SPX",
    email: "kofi.boateng@akwaaba.example",
    name: "Kofi Boateng",
    role: "storekeeper",
  },
  {
    branchId: "WJA",
    email: "selasi.agbeko@akwaaba.example",
    name: "Selasi Agbeko",
    role: "manager",
  },
  {
    branchId: "WJA",
    email: "yaa.oppong@akwaaba.example",
    name: "Yaa Oppong",
    role: "storekeeper",
  },
  {
    branchId: "ASH",
    email: "ibrahim.sulemana@akwaaba.example",
    name: "Ibrahim Sulemana",
    role: "manager",
  },
  {
    branchId: "ASH",
    email: "akua.badu@akwaaba.example",
    name: "Akua Badu",
    role: "storekeeper",
  },
  {
    branchId: "AMS",
    email: "kojo.tetteh@akwaaba.example",
    name: "Kojo Tetteh",
    role: "manager",
  },
  {
    branchId: "AMS",
    email: "adjoa.nkrumah@akwaaba.example",
    name: "Adjoa Nkrumah",
    role: "storekeeper",
  },
  {
    branchId: "KSI",
    email: "kwabena.amoako@akwaaba.example",
    name: "Kwabena Amoako",
    role: "manager",
  },
  {
    branchId: "KSI",
    email: "afia.sarpong@akwaaba.example",
    name: "Afia Sarpong",
    role: "storekeeper",
  },
  {
    branchId: "TMA",
    email: "emmanuel.quartey@akwaaba.example",
    name: "Emmanuel Quartey",
    role: "manager",
  },
  {
    branchId: "TMA",
    email: "gifty.addo@akwaaba.example",
    name: "Gifty Addo",
    role: "storekeeper",
  },
  {
    branchId: "SPX",
    email: "esi.quaye@akwaaba.example",
    name: "Esi Quaye",
    role: "cashier",
  },
  {
    branchId: "WJA",
    email: "nana.yeboah@akwaaba.example",
    name: "Nana Yeboah",
    role: "cashier",
  },
  {
    branchId: "ASH",
    email: "fuseini.iddrisu@akwaaba.example",
    name: "Fuseini Iddrisu",
    role: "cashier",
  },
  {
    branchId: "AMS",
    email: "dzifa.agbenu@akwaaba.example",
    name: "Dzifa Agbenu",
    role: "cashier",
  },
  {
    branchId: "KSI",
    email: "kwame.asamoah@akwaaba.example",
    name: "Kwame Asamoah",
    role: "cashier",
  },
] as const;

/** Every demo account shares this password. Shown on the sign-in page in demo mode. */
export const DEMO_PASSWORD = "akwaaba-demo";
