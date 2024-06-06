import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    colors: {
      primary: '#bbb7e2',
      'primary-dark': '#8680BD',
      'primary-extra-dark': '#56518A',
      'primary-light': '#D4D0FB',
      'primary-extra-light': '#EEEDF8',
      'primary-ultra-light': '#dddbf1',
      'primary-white': '#f8f8fc',
      tertiary: '#EB9AFF',
      'tertiary-dark': '#D275EA',
      'tertiary-light': '#F1BBFF',
      inactive: '#e0e0e0',
      beige: '#dfb995',
      coal: '#1e1928',
      gray: '#828282',
      'gray-medium': '#BDBDBD',
      'gray-dark': '#4F4F4F',
      'gray-light': '#E0E0E0',
      'gray-extra-light': '#F2F2F2',
      green: '#219E71',
      'green-light': '#E9F5F1',
      cream: '#ede6dd',
      offwhite: '#f9f1ea',
      error: '#db3056',
      white: 'white',
      black: 'black',
    },
    fontFamily: {
      serif: ['var(--font-serif)'],
      sans: ['var(--font-sans)'],
    },
  },
  plugins: [],
};
export default config;
