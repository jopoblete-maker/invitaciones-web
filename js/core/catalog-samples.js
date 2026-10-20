(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;root.CatalogSamples=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
// Commercial image references only; no event, theme, renderer or publishing contract.
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const categories=freeze([
  {
    "id": "bodas",
    "label": "Bodas"
  },
  {
    "id": "xv",
    "label": "XV años"
  },
  {
    "id": "cumpleanos",
    "label": "Cumpleaños"
  },
  {
    "id": "infantiles",
    "label": "Baby shower y bautismo"
  },
  {
    "id": "celebraciones",
    "label": "Celebraciones e institucionales"
  },
  {
    "id": "tematicas",
    "label": "Encuentros temáticos"
  },
  {
    "id": "reuniones",
    "label": "Reuniones y gastronomía"
  }
]);
const samples=freeze([
  {
    "id": "muestra-01",
    "number": "01",
    "name": "Boda clásica marfil",
    "category": "bodas",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 22_51_53.png",
    "sourceSha256": "7d3c290da71b7c5384b3dba33dfeba66b84331c24fb40359128b8e54c2788c0a",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-01-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 52042,
      "sha256": "c029db81a80b2fc5accb319c6478d76b0c78fedcf1108a404cc7ed24f1ad7550"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-01.webp",
      "width": 941,
      "height": 1672,
      "bytes": 190244,
      "sha256": "86a9f8d0a33351723930ac3eef10f57bf05082fc233e7924788dce11ca29c629"
    }
  },
  {
    "id": "muestra-02",
    "number": "02",
    "name": "Boda romántica rosa",
    "category": "bodas",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 22_52_30.png",
    "sourceSha256": "aa62905373896062ebe881d5b75021800b8f137eeb781e94c3e241cc3d458913",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-02-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 74836,
      "sha256": "2b27150e74cb6293e57553a1c76f83812569f7becbe0a6103256c606f3971c87"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-02.webp",
      "width": 941,
      "height": 1672,
      "bytes": 299282,
      "sha256": "837af59346201d3f152fdf87de219aa3a9a44d3642fb793eb58a4af0f8e20c4a"
    }
  },
  {
    "id": "muestra-03",
    "number": "03",
    "name": "Boda gala negra y oro",
    "category": "bodas",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 22_57_20.png",
    "sourceSha256": "9925f0950d1cf8e5e0b7958556c64489629082bd029c809c11a48b3f21cc9541",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-03-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 73064,
      "sha256": "b5dda67423a63ac2aa48cd23eafcac9c3d4678bd4f99ea1a00cd2ed4fec5529b"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-03.webp",
      "width": 941,
      "height": 1672,
      "bytes": 269352,
      "sha256": "9caa44cb3f228cee86dd63a857b421983e4b0bc0dd559a7b2e1c954d2358089f"
    }
  },
  {
    "id": "muestra-04",
    "number": "04",
    "name": "Boda campestre oliva",
    "category": "bodas",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 22_53_06.png",
    "sourceSha256": "56aee795ece59ca2cdb774ac00a73e70fd7ccaf83ccb5503b584077d30c88cbd",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-04-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 86596,
      "sha256": "3e1354d9d84d279bc7e25c43ecfd8f4d156489b2cff68c625c60b98dcb4c26f1"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-04.webp",
      "width": 941,
      "height": 1672,
      "bytes": 399138,
      "sha256": "3f3576d25a174c46f5ab8a09be4ed6a5671520d7ae94a33f67e4d40781b47f7f"
    }
  },
  {
    "id": "muestra-05",
    "number": "05",
    "name": "XV princesa rosa",
    "category": "xv",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 22_54_28.png",
    "sourceSha256": "8a361681cbc61259452ed78232206626692688ebbe817ac82fc9cad97f2e019f",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-05-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 96480,
      "sha256": "8e0a2838393291a0aa3fc1a1b8f22c2324b95f67e165d7a211e7d6a06c4fb02e"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-05.webp",
      "width": 941,
      "height": 1672,
      "bytes": 374886,
      "sha256": "1831c486dde08c8dc6e96cc584bb2a6ddd09f46fd2a60ed72242d401199a3026"
    }
  },
  {
    "id": "muestra-06",
    "number": "06",
    "name": "XV lila y mariposas",
    "category": "xv",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 22_54_58.png",
    "sourceSha256": "72883f94e84bc5b0800d5dfd04345f7fe0717b1f47e775612fb6ac91bfb77b2f",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-06-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 68536,
      "sha256": "581de2bad277d29e795a17bf83369b2d1df9a3798485024780e8d426e61b05db"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-06.webp",
      "width": 941,
      "height": 1672,
      "bytes": 242956,
      "sha256": "c4a92f686271ad4607c7bc617978548a20cd0d03f70d62bf2820d771f5f57784"
    }
  },
  {
    "id": "muestra-07",
    "number": "07",
    "name": "Cumpleaños infantil multicolor",
    "category": "cumpleanos",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 22_55_34.png",
    "sourceSha256": "738813d6760c558f1fea9e389223c61db1fa9fc0dbb89f71f3b97cb4591a4a6c",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-07-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 98784,
      "sha256": "4430dba814258e535cbb53ef640e05bb32ef0239f1d9c84893f8b5f837d6ddbb"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-07.webp",
      "width": 941,
      "height": 1672,
      "bytes": 312794,
      "sha256": "e11f34e354d7fa3492778e138e87e3e06cae6dcc057f79820c88661fb362e907"
    }
  },
  {
    "id": "muestra-08",
    "number": "08",
    "name": "Cumpleaños elegante azul y oro",
    "category": "cumpleanos",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 22_56_09.png",
    "sourceSha256": "cd053019168dde4bf91296ae1b18be10ed294733efcec48d2f5ae0b9c03d9639",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-08-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 65868,
      "sha256": "17153234b4d52970bece9212f1793a04dca30d795a82c2541924f5d297d3fb80"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-08.webp",
      "width": 941,
      "height": 1672,
      "bytes": 238736,
      "sha256": "9706223743766e95a0c83518ea470797a4519886508a7244cce5223ab9fd3177"
    }
  },
  {
    "id": "muestra-09",
    "number": "09",
    "name": "Baby shower osito",
    "category": "infantiles",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 22_56_38.png",
    "sourceSha256": "f490859fd4a852b3f42d31c305e74267a460563a522f1616f89c7acf666ad9c8",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-09-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 53430,
      "sha256": "ac2a85a045be0af4caccc67b542ce73b20aa2117e6071e2ada85d7412dcad90e"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-09.webp",
      "width": 941,
      "height": 1672,
      "bytes": 198686,
      "sha256": "61205185dca6035acabb84fc74b043c64fd02894b52fdfe94870968579a3e994"
    }
  },
  {
    "id": "muestra-10",
    "number": "10",
    "name": "Bautismo celeste",
    "category": "infantiles",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 22_56_57.png",
    "sourceSha256": "6bf223c4fce0a56e4c6d98ce92f8eff928c3bed7b4fc6022c75dda7eb09dc17b",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-10-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 55356,
      "sha256": "6601a1fc878edb356c85cd5d79614c17785e1a1f49c805a35c47c21ade820210"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-10.webp",
      "width": 941,
      "height": 1672,
      "bytes": 206536,
      "sha256": "517de666964ff4ca47b497eab54c282897a2be0632c6c88981b19770a4c5ed61"
    }
  },
  {
    "id": "muestra-12",
    "number": "12",
    "name": "Egresados",
    "category": "celebraciones",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 23_03_51.png",
    "sourceSha256": "f2dac3e94e93b55fdc2a8d2e16fdafc89f234ce7714c50e18f9f41141816f5ea",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-12-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 88948,
      "sha256": "038d84de412f35cf730bda98bda25ce4e2235aaafb6c29061d402f015ed39478"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-12.webp",
      "width": 941,
      "height": 1672,
      "bytes": 299070,
      "sha256": "b8c9549789a7a05e799cb0d616f910302a52c28363ea798c4c455c4a146eadc2"
    }
  },
  {
    "id": "muestra-13",
    "number": "13",
    "name": "Evento empresarial",
    "category": "celebraciones",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 23_04_15.png",
    "sourceSha256": "9af6b9ddf67a7bde96cd6febab043623b7bea7adda9b566db9198abda57acb01",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-13-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 61566,
      "sha256": "a3f2abf2fb6b863330b9eb92e92edde10fbcf3b82ea458d8edefa2918db21c72"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-13.webp",
      "width": 941,
      "height": 1672,
      "bytes": 223738,
      "sha256": "a5e8b2f9144b4e666b6fff58beaa2a5cb740b3dabbcb626c36be370ac3c47f11"
    }
  },
  {
    "id": "muestra-14",
    "number": "14",
    "name": "Cumpleaños tropical",
    "category": "cumpleanos",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 23_04_48.png",
    "sourceSha256": "06a220570f793611e56e3feddb434c3bf0fafb53cbcb435f38a4154f6a2ee23c",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-14-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 144476,
      "sha256": "cd860e62c77a5b5849af213bf4f99d52c6def8111c9462c6802bc86d2e49d3fe"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-14.webp",
      "width": 941,
      "height": 1672,
      "bytes": 522290,
      "sha256": "d184bf0b58237a95dee5d3bc7ad2da2c3e70c488de89868b9740ab62b23ad8c9"
    }
  },
  {
    "id": "muestra-17",
    "number": "17",
    "name": "Encuentro de cacería",
    "category": "tematicas",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 23_09_02.png",
    "sourceSha256": "3e056d7410b4e19a91114dd872a456aaf987e2d6b0d2803668e298af218c6e95",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-17-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 101134,
      "sha256": "afe7d572970a290092740456738fc3cae25cf1a374251c10834a3d898f2fcda8"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-17.webp",
      "width": 941,
      "height": 1672,
      "bytes": 464264,
      "sha256": "938c9002318273a215958c4fbfe89698a99eb2dc3457cefc19cdcd0339d6afdc"
    }
  },
  {
    "id": "muestra-18",
    "number": "18",
    "name": "Fiesta deportiva",
    "category": "tematicas",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 23_09_25.png",
    "sourceSha256": "7df31c302701568df65640b39730f45025e26c2d66afccaf12c409fd0b9dd516",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-18-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 110108,
      "sha256": "2f7b5a10ea59cd043a33ae7dced87efef6860e90e24c82e66164eedd4d2d3dcb"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-18.webp",
      "width": 941,
      "height": 1672,
      "bytes": 417564,
      "sha256": "0ad2581cd8bce3dbd7b0c39fe48e232f2f07eac786abff392cb8e6f3d6e0cfe2"
    }
  },
  {
    "id": "muestra-19",
    "number": "19",
    "name": "Celebramos entre paisajes",
    "category": "tematicas",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 23_09_51.png",
    "sourceSha256": "20c1719f58f4d984efab38afe4836f4dcbe6123ded8b2a6d51ae353c9725908b",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-19-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 77190,
      "sha256": "3436f90f54d59a33ef266c3f1d3c2f98c46d528faca624f97914f6a510396678"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-19.webp",
      "width": 941,
      "height": 1672,
      "bytes": 310510,
      "sha256": "7a8d69e7af565a56b8927f139ac9e4634e4fa249448a4611611c35cbb8e6c72e"
    }
  },
  {
    "id": "muestra-20",
    "number": "20",
    "name": "Nos vamos de viaje",
    "category": "tematicas",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 23_10_17.png",
    "sourceSha256": "b21efdfd01d007b4b74d9a4a5324174b6a3d2921d54299375cd1c0d7cd32beaa",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-20-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 119416,
      "sha256": "be792caa842131e5c1a4bb06a27aaa2d5adcfba3c52f164251976f7270511def"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-20.webp",
      "width": 941,
      "height": 1672,
      "bytes": 494332,
      "sha256": "3477c0dadf0a1bb9557167e316d143659b36b72a86cf4ae1347872897fa166ca"
    }
  },
  {
    "id": "muestra-21",
    "number": "21",
    "name": "Nos reunimos",
    "category": "reuniones",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 23_10_36.png",
    "sourceSha256": "bcc489051721fb13bb4a97629315a3bcb04780df0f72f2c5c5e8136971443c60",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-21-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 68986,
      "sha256": "fc4fa73607b31d44b8acc68eb90240e55ac36cff793119d1aba919430058c73e"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-21.webp",
      "width": 941,
      "height": 1672,
      "bytes": 241496,
      "sha256": "f073b4b3c88d3623b70b514d0703801e81eeb6b228bdf1e1beba9ae34ab9595d"
    }
  },
  {
    "id": "muestra-22",
    "number": "22",
    "name": "Fiesta de jubilación",
    "category": "celebraciones",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 23_10_52.png",
    "sourceSha256": "cb909b64761a3c10d215052b8e514e198b1e71a8252dc2320b97d526600ae1e7",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-22-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 98818,
      "sha256": "39978dab6300cdef04285511b022b46eb337d003cc05e8d2e7db4e1ed97a93d2"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-22.webp",
      "width": 941,
      "height": 1672,
      "bytes": 363398,
      "sha256": "d60cc1482e9132d80c22a4efa5e09cb65758fea7f56e693faa3d6bcf422eb474"
    }
  },
  {
    "id": "muestra-23",
    "number": "23",
    "name": "Asado con amigos",
    "category": "reuniones",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 23_11_29.png",
    "sourceSha256": "3b654d5e7533092c6d4ca26cf9b215ebb25b30b673418201947f1b5cd7058a8b",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-23-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 112862,
      "sha256": "73bc3753d0ed677911a2033b437889763d8a38545a9243cf1ffe036995622b58"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-23.webp",
      "width": 941,
      "height": 1672,
      "bytes": 432162,
      "sha256": "aaf004a92b9e14e01af35de87343cd0273d533816ee7e610628981747b210a46"
    }
  },
  {
    "id": "muestra-24",
    "number": "24",
    "name": "Cena con amigos",
    "category": "reuniones",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 23_11_44.png",
    "sourceSha256": "80fa6834c2347e22810ebdc59e4f25c98f9c36b1ef2347428ec2e6f1f410640d",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-24-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 83520,
      "sha256": "7d05c0de1fb994582752b7e077cc855ed6922ad717c6d4cbea218dcccd062939"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-24.webp",
      "width": 941,
      "height": 1672,
      "bytes": 294806,
      "sha256": "da9f80745f806b2b67b522e929b4f4ccade27f0c95e25303aa45284f7c9cbdf6"
    }
  },
  {
    "id": "muestra-25",
    "number": "25",
    "name": "Cena en familia",
    "category": "reuniones",
    "sourceFile": "Imagen de ChatGPT 19 oct 2026, 23_11_57.png",
    "sourceSha256": "9c515a2f93540e1523dc81bfe353e0de34d42cf4a9c3c45bc1c34adea19dcce7",
    "thumbnail": {
      "src": "/assets/catalogo/muestras/muestra-25-mini.webp",
      "width": 480,
      "height": 853,
      "bytes": 86072,
      "sha256": "c857be6f17e3dd043827fa9af1e02942c9f646a85a64acd429c96b14bb11c59d"
    },
    "image": {
      "src": "/assets/catalogo/muestras/muestra-25.webp",
      "width": 941,
      "height": 1672,
      "bytes": 317816,
      "sha256": "47d5715d364ae2c4f5b0e4abbe056bed6bc7c6ab509a7f0900ad567ff0b86fde"
    }
  }
]);
function getSample(id){return typeof id==="string"?samples.find(s=>s.id===id)||null:null;}
return Object.freeze({list:()=>samples,categories:()=>categories,getSample});
});
