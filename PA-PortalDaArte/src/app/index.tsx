import { Redirect } from "expo-router";
import React from "react";

// A primeira tela do site é Descobrir (pública). O arquivo continua em
// pages/explorar/explorar para não quebrar caminhos nem links existentes.
export default function IndexScreen() {
  return <Redirect href={"/pages/explorar/explorar" as any} />;
}
