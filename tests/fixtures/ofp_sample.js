// 테스트용 가공 OFP — 실제 운항 데이터 아님(전부 허구값), 구조만 OZ APMS/Lido 형식을 따름
export const OFP_SAMPLE = `
                       OZ 998/01 Jan/ICN-HKG
OFP

FLT RLS MSG FOR AAR998 01/JAN/2026 HL7000 RKSI/VHHH
--------- -------- --------- --------- --------- --------- ---------
   PEK : STD/01.00Z ETD/01.00Z HKG : STA/04.50Z ETA/04.40Z

                        OZ 998/01 Jan/ICN-HKG
OZ998 RKSI/VHHH 01/JAN/2026       OFP 1:0001Z      PAGE 1/5
--------- -------- --------- --------- --------- --------- ---------

AAR998    01/JAN/2026 HL7000 A321-251NX         TEST    APMS/2.9
WIND/TEMP M010/M30    DIST    1150/1120          SPD:    CI030-CI030-CI030

ICN/RKSI P0900 : STD/ 01.00Z ETD/01.00           ATD-       /
HKG/VHHH P0800 : STA/ 04.50Z ETA/04.40           ATA-       /

            FUEL   TIME             PLAN        ACTL              UNIT:100LBS

TRIP        0150   03.40         SOW 01173
CONT        0010   00.14 / 5%    PLD 00380         MTOW               01962
ALTN/VMMC   0015   00.15         ZFW 01553         MZFW 1666 TOF 0220 01842
F-RSV       0023   00.30         TOF 00220         MLDW 1746 TIF 0150 01833
                                 TOW 01750
RQRD        0198   04.39         TIF 00150
EXTRA       0020   00.25 RSN/TFC LDW 01600         AGTOW                 01833
PAD         0000   00.00
TKOF        0218   05.04
TAXI        0006
RAMP        0224   05.04
DISP REMARK:
   * EXTRA FUEL DUE TO VHHH TFC CONGESTION
--------- -------- --------- --------- --------- --------- ---------
ALTN SUMMARY:
 ALTN       DIST   FL     TIME    WIND   FUEL    RTE
 VMMC/34    040    100    00.15   M02    0015    DCT
 VHHX/25    010    060    00.08   P01    0009    DCT
--------- -------- --------- --------- --------- --------- ---------
DST POINT    FL   MC LAT     ETO REM OT WIND - COMP SR TAS ZT/ACTM
FREQ    AWY  MORA TC LONGI   ATO ACTL AT ACTL - WIND TP G/S TIF/ACTF
--------- -------- --------- --------- --------- --------- ---------
090 TOC       CL 190 N036 00.0...0210 40 27/020 M012         15/00.15
              010 182 E126 10.0                       45 438 012/0022
--------- -------- --------- --------- --------- --------- --------
120 ALPHA     351 190 N034 30.0...0195 46 27/022 M014 02 450 16/00.31
              010 182 E124 50.0                       46 436 018/0040
ALPHA/A593
--------- -------- --------- --------- --------- --------- --------
200 BRAVO     351 195 N031 20.0...0170 47 28/025 M016 02 450 27/00.58
              010 187 E122 30.0                       46 434 030/0070
BRAVO/A470                                                     -VHHK
--------- -------- --------- --------- --------- --------- --------
180 CHALI     351 200 N028 20.0...0150 47 29/020 M010 02 450 24/01.22
              010 192 E119 50.0                       46 440 026/0096
CHALI/A470
--------- -------- --------- --------- --------- --------- --------
150 TOD      351 205 N026 00.0...0135 47 30/015 M006     450 20/01.42
             010 197 E117 40.0                       46 444 020/0116

ONE FL BLW. TIF 0152    TIME 03.42    WIND/M012

ADV CFP VALID UNTIL:0800Z 01/JAN/2026

UPPER WIND/TEMP DATA: PROG 0100 0106
WPT      WIND/OAT
         10000       15000       20000           31000        35000
CLB    18012P06    21020M03    22027M13        27017M38     28023M48

        (29000)    (31000)    (33000)    (35000)    (37000)    (39000)
TOC     19018M34   20020M40   20021M44   20022M50   21024M56   21026M60
ALPHA   19020M34   20022M40   20023M44   20024M50   21026M56   21028M60
BRAVO   20022M34   20025M40   21026M44   21027M50   21029M56   22031M60
CHALI   20018M34   21020M40   21021M44   21022M50   22024M56   22026M60
TOD     21014M34   21015M40   21016M44   22017M50   22018M56   22020M60

          39000        35000        31000        20000        10000
DSC     03005M59     22008M52     19007M42     25002M13     16015P08

ATC Flight Plan

(FPL-AAR998-IS
-A21N/M-SDE2E3FGHIJ3J7M3P2RWXYZ/LB1D1
-RKSI0100
-N0450F350 OLMEN Y722 ALPHA A593 BRAVO A470 CHALI/N0450F351 A470
 SIERA SIERA1A
-VHHH0340 VMMC VHHX
-PBN/A1B1C1D1L1O1S2 DOF/260101
 REG/HL7000 EET/VHHK0058 SEL/ABCD CODE/700000
 OPR/AAR PER/C RMK/TCAS II EQUIPPED)
`;
