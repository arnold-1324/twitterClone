import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import "./streams.css";
import { ChakraProvider, ColorModeScript, extendTheme } from "@chakra-ui/react";
import { mode } from "@chakra-ui/theme-tools";
import { BrowserRouter } from 'react-router-dom';
import { AppStateProvider } from "./state/AppStateProvider";
import { CallProvider } from "./context/CallContext.jsx";
import { SocketContextProvider } from "./context/SocketContext.jsx";
import LiveLocationProvider from "./context/LiveLocationProvider.jsx";

const styles = {
  global:(props)=>({
    body:{
      color:mode('gray.800','whiteAlpha.900')(props),
      bg:mode('#f7f5f2','#131217')(props),
    }
  })
};

const config = {
  initialColorMode: "dark",
  useSystemColorMode: false,
};

const colors = {
  gray: {
    light: "#616161",
    dark: "#1e1e1e",
  },
};

const theme = extendTheme({ config, styles, colors });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppStateProvider>
      <BrowserRouter>
        <ChakraProvider theme={theme}>
          <ColorModeScript initialColorMode={theme.config.initialColorMode} />
          <SocketContextProvider>
            <CallProvider><LiveLocationProvider><App /></LiveLocationProvider></CallProvider>
          </SocketContextProvider>
        </ChakraProvider>
      </BrowserRouter>
    </AppStateProvider>
  </React.StrictMode>,
)
